import { AudioOutputMessage, UserTranscriptMessage, AssistantTranscriptMessage, UserInterruptionMessage, JSONErrorMessage, VoiceEventMap, SessionSettings, SocketConfig, createSocketConfig, JSONMessage } from '@humeai/voice';
export { AssistantEndMessage, AssistantTranscriptMessage, AudioEncoding, AudioMessage, AudioOutputMessage, Channels, JSONMessage, LanguageModelOption, SocketConfig, TTSService, TimeSlice, UserInterruptionMessage, UserTranscriptMessage } from '@humeai/voice';
import { MutableRefObject, PropsWithChildren, FC } from 'react';

declare const useSoundPlayer: (props: {
    onError: (message: string) => void;
    onPlayAudio: (id: string) => void;
}) => {
    addToQueue: (message: AudioOutputMessage) => Promise<void>;
    fft: number[];
    initPlayer: () => void;
    isPlaying: boolean;
    stopAll: () => void;
    clearQueue: () => void;
};

type MicrophoneProps = {
    streamRef: MutableRefObject<MediaStream | null>;
    onAudioCaptured: (b: ArrayBuffer) => void;
    onStartRecording?: () => void;
    onStopRecording?: () => void;
    onError: (message: string) => void;
};
declare const useMicrophone: (props: MicrophoneProps) => {
    start: () => void;
    stop: () => void;
    mute: () => void;
    unmute: () => void;
    isMuted: boolean;
    fft: number[];
};

type ConnectionMessage = {
    type: 'socket_connected';
    receivedAt: Date;
} | {
    type: 'socket_disconnected';
    receivedAt: Date;
};

declare enum VoiceReadyState {
    IDLE = "idle",
    CONNECTING = "connecting",
    OPEN = "open",
    CLOSED = "closed"
}
declare const useVoiceClient: (props: {
    onAudioMessage?: ((message: AudioOutputMessage) => void) | undefined;
    onMessage?: ((message: UserTranscriptMessage | AssistantTranscriptMessage | UserInterruptionMessage | JSONErrorMessage) => void) | undefined;
    onError?: ((message: string, error?: Error) => void) | undefined;
    onOpen?: (() => void) | undefined;
    onClose?: VoiceEventMap['close'];
}) => {
    readyState: VoiceReadyState;
    sendSessionSettings: (sessionSettings: SessionSettings) => void;
    sendAudio: (arrayBuffer: ArrayBufferLike) => void;
    connect: (config: SocketConfig) => Promise<unknown>;
    disconnect: () => void;
    sendUserInput: (text: string) => void;
    sendAssistantInput: (text: string) => void;
};

type VoiceError = {
    type: 'socket_error';
    message: string;
    error?: Error;
} | {
    type: 'audio_error';
    message: string;
    error?: Error;
} | {
    type: 'mic_error';
    message: string;
    error?: Error;
};
type VoiceStatus = {
    value: 'disconnected' | 'connecting' | 'connected';
    reason?: never;
} | {
    value: 'error';
    reason: string;
};
type VoiceContextType = {
    connect: () => Promise<void>;
    disconnect: () => void;
    fft: number[];
    isMuted: boolean;
    isPlaying: boolean;
    messages: (UserTranscriptMessage | AssistantTranscriptMessage | ConnectionMessage | UserInterruptionMessage | JSONErrorMessage)[];
    lastVoiceMessage: AssistantTranscriptMessage | null;
    lastUserMessage: UserTranscriptMessage | null;
    clearMessages: () => void;
    mute: () => void;
    unmute: () => void;
    readyState: VoiceReadyState;
    sendUserInput: (text: string) => void;
    sendAssistantInput: (text: string) => void;
    sendSessionSettings: (sessionSettings: SessionSettings) => void;
    status: VoiceStatus;
    micFft: number[];
    error: VoiceError | null;
    isAudioError: boolean;
    isError: boolean;
    isMicrophoneError: boolean;
    isSocketError: boolean;
    callDurationTimestamp: string | null;
};
type VoiceProviderProps = PropsWithChildren<Parameters<typeof createSocketConfig>[0]> & {
    sessionSettings?: SessionSettings;
    onMessage?: (message: JSONMessage) => void;
    onError?: (err: VoiceError) => void;
    onOpen?: () => void;
    onClose?: VoiceEventMap['close'];
    /**
     * @default true
     * @description Clear messages when the voice is disconnected.
     */
    clearMessagesOnDisconnect?: boolean;
    /**
     * @default 100
     * @description The maximum number of messages to keep in memory.
     */
    messageHistoryLimit?: number;
};
declare const useVoice: () => VoiceContextType;
declare const VoiceProvider: FC<VoiceProviderProps>;

export { type ConnectionMessage, type MicrophoneProps, type VoiceContextType, VoiceProvider, type VoiceProviderProps, VoiceReadyState, useMicrophone, useSoundPlayer, useVoice, useVoiceClient };
