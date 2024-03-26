import {
  AgentTranscriptMessage,
  AudioOutputMessage,
  createConfig,
  JSONErrorMessage,
  JSONMessage,
  UserInterruptionMessage,
  UserTranscriptMessage,
  VoiceEventMap,
} from '@humeai/voice';
import React, {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ConnectionMessage } from './connection-message';
import { noop } from './noop';
import { useEncoding } from './useEncoding';
import { useMessages } from './useMessages';
import { useMicrophone } from './useMicrophone';
import { useSoundPlayer } from './useSoundPlayer';
import { useVoiceClient, type VoiceReadyState } from './useVoiceClient';

type VoiceError =
  | { type: 'socket_error'; message: string; error?: Error }
  | { type: 'audio_error'; message: string; error?: Error }
  | { type: 'mic_error'; message: string; error?: Error };

type VoiceStatus =
  | {
      value: 'disconnected' | 'connecting' | 'connected';
      reason?: never;
    }
  | {
      value: 'error';
      reason: string;
    };

export type VoiceContextType = {
  connect: () => Promise<void>;
  disconnect: () => void;
  fft: number[];
  isMuted: boolean;
  isPlaying: boolean;
  messages: (
    | UserTranscriptMessage
    | AgentTranscriptMessage
    | ConnectionMessage
    | UserInterruptionMessage
    | JSONErrorMessage
  )[];
  lastVoiceMessage: AgentTranscriptMessage | null;
  lastUserMessage: UserTranscriptMessage | null;
  clearMessages: () => void;
  mute: () => void;
  unmute: () => void;
  readyState: VoiceReadyState;
  sendText: (text: string) => void;
  status: VoiceStatus;
  micFft: number[];
  error: VoiceError | null;
  isAudioError: boolean;
  isError: boolean;
  isMicrophoneError: boolean;
  isSocketError: boolean;
};

const VoiceContext = createContext<VoiceContextType | null>(null);

export type VoiceProviderProps = PropsWithChildren<
  Parameters<typeof createConfig>[0]
> & {
  onMessage?: (message: JSONMessage) => void;
  onError?: (err: VoiceError) => void;
  onOpen?: () => void;
  onClose?: VoiceEventMap['close'];
  /**
   * @default true
   * @description Clear messages when the voice is disconnected.
   */
  clearMessagesOnDisconnect?: boolean;
};

export const useVoice = () => {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error('useVoice must be used within an VoiceProvider');
  }
  return ctx;
};

export const VoiceProvider: FC<VoiceProviderProps> = ({
  children,
  clearMessagesOnDisconnect = true,
  ...props
}) => {
  const [status, setStatus] = useState<VoiceStatus>({
    value: 'disconnected',
  });

  // error handling
  const [error, setError] = useState<VoiceError | null>(null);
  const isError = error !== null;
  const isMicrophoneError = error?.type === 'mic_error';
  const isSocketError = error?.type === 'socket_error';
  const isAudioError = error?.type === 'audio_error';

  const onError = useRef(props.onError ?? noop);
  onError.current = props.onError ?? noop;

  const onClose = useRef(props.onClose ?? noop);
  onClose.current = props.onClose ?? noop;

  const messageStore = useMessages({
    sendMessageToParent: props.onMessage,
  });

  const updateError = useCallback((err: VoiceError | null) => {
    setError(err);
    if (err !== null) {
      onError.current?.(err);
    }
  }, []);

  const onClientError: NonNullable<
    Parameters<typeof useVoiceClient>[0]['onError']
  > = useCallback(
    (message, err) => {
      updateError({ type: 'socket_error', message, error: err });
    },
    [updateError],
  );

  const config = createConfig(props);

  const player = useSoundPlayer({
    onError: (message) => {
      updateError({ type: 'audio_error', message });
    },
    onPlayAudio: (id: string) => {
      messageStore.onPlayAudio(id);
    },
  });

  const { streamRef, getStream, permission: micPermission } = useEncoding();

  const client = useVoiceClient({
    onAudioMessage: (message: AudioOutputMessage) => {
      player.addToQueue(message);
    },
    onMessage: useCallback(
      (
        message:
          | UserTranscriptMessage
          | AgentTranscriptMessage
          | UserInterruptionMessage
          | JSONErrorMessage,
      ) => {
        // store message
        messageStore.onMessage(message);

        if (message.type === 'user_interruption') {
          player.clearQueue();
        }
      },
      [player],
    ),
    onError: onClientError,
    onOpen: useCallback(() => {
      messageStore.createConnectMessage();
      props.onOpen?.();
    }, [props.onOpen]),
    onClose: useCallback<NonNullable<VoiceEventMap['close']>>((event) => {
      messageStore.createDisconnectMessage();
      onClose.current?.(event);
    }, []),
  });

  const mic = useMicrophone({
    streamRef,
    onAudioCaptured: useCallback((arrayBuffer) => {
      try {
        client.sendAudio(arrayBuffer);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        updateError({ type: 'socket_error', message });
      }
    }, []),
    onError: useCallback(
      (message) => {
        updateError({ type: 'mic_error', message });
      },
      [updateError],
    ),
  });

  const connect = useCallback(async () => {
    updateError(null);
    setStatus({ value: 'connecting' });
    const permission = await getStream();

    if (permission === 'denied') {
      const error: VoiceError = {
        type: 'mic_error',
        message: 'Microphone permission denied',
      };
      updateError(error);
      return Promise.reject(error);
    }

    const err = await client
      .connect({
        ...config,
      })
      .then(() => {
        if (props.systemPrompt) {
          try {
            client.sendSystemPrompt(props.systemPrompt);
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            updateError({ type: 'socket_error', message });
          }
        }
      })
      .catch(() => new Error('Could not connect to the voice'));

    if (err) {
      const error: VoiceError = {
        type: 'socket_error',
        message: 'We could not connect to the voice. Please try again.',
      };
      updateError(error);
      return Promise.reject(error);
    }

    const [micPromise, playerPromise] = await Promise.allSettled([
      mic.start(),
      player.initPlayer(),
    ]);

    if (
      micPromise.status === 'fulfilled' &&
      playerPromise.status === 'fulfilled'
    ) {
      setStatus({ value: 'connected' });
    }
  }, [client, config, getStream, mic, player, updateError]);

  const disconnectFromVoice = useCallback(() => {
    client.disconnect();
    player.stopAll();
    mic.stop();
    if (clearMessagesOnDisconnect) {
      messageStore.clearMessages();
    }
  }, [client, player, mic]);

  const disconnect = useCallback(
    (disconnectOnError?: boolean) => {
      if (micPermission === 'denied') {
        setStatus({ value: 'error', reason: 'Microphone permission denied' });
      }

      disconnectFromVoice();

      if (status.value !== 'error' && !disconnectOnError) {
        // if status was 'error', keep the error status so we can show the error message to the end user.
        // otherwise, set status to 'disconnected'
        setStatus({ value: 'disconnected' });
      }
    },
    [micPermission, status.value, disconnectFromVoice],
  );

  useEffect(() => {
    if (
      error !== null &&
      status.value !== 'error' &&
      status.value !== 'disconnected'
    ) {
      // If the status is ever set to `error`, disconnect the voice.
      setStatus({ value: 'error', reason: error.message });
      disconnectFromVoice();
    }
  }, [status.value, disconnect, disconnectFromVoice, error]);

  const ctx = useMemo(
    () =>
      ({
        connect,
        disconnect,
        fft: player.fft,
        micFft: mic.fft,
        isMuted: mic.isMuted,
        isPlaying: player.isPlaying,
        messages: messageStore.messages,
        lastVoiceMessage: messageStore.lastVoiceMessage,
        lastUserMessage: messageStore.lastUserMessage,
        clearMessages: messageStore.clearMessages,
        mute: mic.mute,
        readyState: client.readyState,
        sendText: client.sendText,
        status,
        unmute: mic.unmute,
        error,
        isAudioError,
        isError,
        isMicrophoneError,
        isSocketError,
      }) satisfies VoiceContextType,
    [
      connect,
      disconnect,
      player.fft,
      player.isPlaying,
      mic.fft,
      mic.isMuted,
      mic.mute,
      mic.unmute,
      messageStore.messages,
      messageStore.lastVoiceMessage,
      messageStore.lastUserMessage,
      messageStore.clearMessages,
      client.readyState,
      client.sendText,
      status,
      error,
      isAudioError,
      isError,
      isMicrophoneError,
      isSocketError,
    ],
  );

  return <VoiceContext.Provider value={ctx}>{children}</VoiceContext.Provider>;
};
