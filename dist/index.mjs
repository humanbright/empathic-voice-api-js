'use client';

// src/lib/useSoundPlayer.ts
import { base64ToBlob } from "@humeai/voice";
import { useCallback, useRef, useState } from "react";

// src/lib/convertFrequencyScale.ts
var barkCenterFrequencies = [
  50,
  150,
  250,
  350,
  450,
  570,
  700,
  840,
  1e3,
  1170,
  1370,
  1600,
  1850,
  2150,
  2500,
  2900,
  3400,
  4e3,
  4800,
  5800,
  7e3,
  8500,
  10500,
  13500
];
var minValue = 0;
var maxValue = 255;
function convertLinearFrequenciesToBark(linearData, sampleRate) {
  const maxFrequency = sampleRate / 2;
  const frequencyResolution = maxFrequency / linearData.length;
  const barkFrequencies = barkCenterFrequencies.map((barkFreq) => {
    const linearDataIndex = Math.round(barkFreq / frequencyResolution);
    if (linearDataIndex >= 0 && linearDataIndex < linearData.length) {
      return ((linearData[linearDataIndex] ?? 0) - minValue) / (maxValue - minValue) * 2;
    } else {
      return 0;
    }
  });
  return barkFrequencies;
}

// src/lib/generateEmptyFft.ts
function generateEmptyFft() {
  return Array.from({ length: 24 }).map(() => 0);
}

// src/lib/useSoundPlayer.ts
var useSoundPlayer = (props) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [fft, setFft] = useState(generateEmptyFft());
  const audioContext = useRef(null);
  const analyserNode = useRef(null);
  const isInitialized = useRef(false);
  const clipQueue = useRef([]);
  const isProcessing = useRef(false);
  const currentlyPlayingAudioBuffer = useRef(
    null
  );
  const frequencyDataIntervalId = useRef(null);
  const onPlayAudio = useRef(props.onPlayAudio);
  onPlayAudio.current = props.onPlayAudio;
  const onError = useRef(props.onError);
  onError.current = props.onError;
  const playNextClip = useCallback(() => {
    if (analyserNode.current === null || audioContext.current === null) {
      onError.current("Audio environment is not initialized");
      return;
    }
    if (clipQueue.current.length === 0 || isProcessing.current) {
      return;
    }
    const nextClip = clipQueue.current.shift();
    if (!nextClip)
      return;
    isProcessing.current = true;
    setIsPlaying(true);
    const bufferSource = audioContext.current.createBufferSource();
    bufferSource.buffer = nextClip.buffer;
    bufferSource.connect(analyserNode.current);
    currentlyPlayingAudioBuffer.current = bufferSource;
    const updateFrequencyData = () => {
      const bufferSampleRate = bufferSource.buffer?.sampleRate;
      if (!analyserNode.current || typeof bufferSampleRate === "undefined")
        return;
      const dataArray = new Uint8Array(analyserNode.current.frequencyBinCount);
      analyserNode.current.getByteFrequencyData(dataArray);
      const barkFrequencies = convertLinearFrequenciesToBark(
        dataArray,
        bufferSampleRate
      );
      setFft(() => barkFrequencies);
    };
    frequencyDataIntervalId.current = window.setInterval(
      updateFrequencyData,
      5
    );
    bufferSource.start(0);
    onPlayAudio.current(nextClip.id);
    bufferSource.onended = () => {
      if (frequencyDataIntervalId.current) {
        clearInterval(frequencyDataIntervalId.current);
      }
      setFft(generateEmptyFft());
      bufferSource.disconnect();
      isProcessing.current = false;
      setIsPlaying(false);
      currentlyPlayingAudioBuffer.current = null;
      playNextClip();
    };
  }, []);
  const initPlayer = useCallback(() => {
    const initAudioContext = new AudioContext();
    audioContext.current = initAudioContext;
    const analyser = initAudioContext.createAnalyser();
    analyser.connect(initAudioContext.destination);
    analyser.fftSize = 2048;
    analyserNode.current = analyser;
    isInitialized.current = true;
  }, []);
  const addToQueue = useCallback(
    async (message) => {
      if (!isInitialized.current || !audioContext.current) {
        onError.current("Audio player has not been initialized");
        return;
      }
      try {
        const blob = base64ToBlob(message.data, "audio/mp3");
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);
        clipQueue.current.push({
          id: message.id,
          buffer: audioBuffer
        });
        if (clipQueue.current.length === 1) {
          playNextClip();
        }
      } catch (e) {
        const eMessage = e instanceof Error ? e.message : "Unknown error";
        onError.current(`Failed to add clip to queue: ${eMessage}`);
      }
    },
    [playNextClip]
  );
  const stopAll = useCallback(() => {
    isInitialized.current = false;
    isProcessing.current = false;
    setIsPlaying(false);
    if (frequencyDataIntervalId.current) {
      window.clearInterval(frequencyDataIntervalId.current);
    }
    if (currentlyPlayingAudioBuffer.current) {
      currentlyPlayingAudioBuffer.current.disconnect();
      currentlyPlayingAudioBuffer.current = null;
    }
    if (analyserNode.current) {
      analyserNode.current.disconnect();
      analyserNode.current = null;
    }
    if (audioContext.current) {
      void audioContext.current.close().then(() => {
        audioContext.current = null;
      }).catch(() => {
        return null;
      });
    }
    clipQueue.current = [];
    setFft(generateEmptyFft());
  }, []);
  const clearQueue = useCallback(() => {
    if (currentlyPlayingAudioBuffer.current) {
      currentlyPlayingAudioBuffer.current.stop();
      currentlyPlayingAudioBuffer.current = null;
    }
    clipQueue.current = [];
    isProcessing.current = false;
    setIsPlaying(false);
    setFft(generateEmptyFft());
  }, []);
  return {
    addToQueue,
    fft,
    initPlayer,
    isPlaying,
    stopAll,
    clearQueue
  };
};

// src/lib/useMicrophone.ts
import { getSupportedMimeType } from "@humeai/voice";
import Meyda from "meyda";
import { useCallback as useCallback2, useEffect, useRef as useRef2, useState as useState2 } from "react";
var useMicrophone = (props) => {
  const { streamRef, onAudioCaptured, onError } = props;
  const [isMuted, setIsMuted] = useState2(false);
  const isMutedRef = useRef2(isMuted);
  const [fft, setFft] = useState2(generateEmptyFft());
  const currentAnalyzer = useRef2(null);
  const mimeTypeRef = useRef2(null);
  const audioContext = useRef2(null);
  const recorder = useRef2(null);
  const sendAudio = useRef2(onAudioCaptured);
  sendAudio.current = onAudioCaptured;
  const dataHandler = useCallback2((event) => {
    if (isMutedRef.current) {
      return;
    }
    const blob = event.data;
    blob.arrayBuffer().then((buffer) => {
      if (buffer.byteLength > 0) {
        sendAudio.current?.(buffer);
      }
    }).catch((err) => {
      console.log(err);
    });
  }, []);
  const start = useCallback2(() => {
    const stream = streamRef.current;
    if (!stream) {
      throw new Error("No stream connected");
    }
    const context = new AudioContext();
    audioContext.current = context;
    const input = context.createMediaStreamSource(stream);
    try {
      currentAnalyzer.current = Meyda.createMeydaAnalyzer({
        audioContext: context,
        source: input,
        featureExtractors: ["loudness"],
        callback: (features) => {
          const newFft = features.loudness.specific || [];
          setFft(() => Array.from(newFft));
        }
      });
      currentAnalyzer.current.start();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(`Failed to start mic analyzer: ${message}`);
    }
    const mimeType = mimeTypeRef.current;
    if (!mimeType) {
      throw new Error("No MimeType specified");
    }
    recorder.current = new MediaRecorder(stream, {
      mimeType
    });
    recorder.current.addEventListener("dataavailable", dataHandler);
    recorder.current.start(100);
  }, [dataHandler, streamRef, mimeTypeRef]);
  const stop = useCallback2(() => {
    try {
      if (currentAnalyzer.current) {
        currentAnalyzer.current.stop();
        currentAnalyzer.current = null;
      }
      if (audioContext.current) {
        void audioContext.current.close().then(() => {
          audioContext.current = null;
        }).catch(() => {
          return null;
        });
      }
      recorder.current?.stop();
      recorder.current?.removeEventListener("dataavailable", dataHandler);
      recorder.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setIsMuted(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      onError(`Error stopping microphone: ${message}`);
      console.log(e);
    }
  }, [dataHandler, onError, streamRef]);
  const mute = useCallback2(() => {
    if (currentAnalyzer.current) {
      currentAnalyzer.current.stop();
      setFft(generateEmptyFft());
    }
    streamRef.current?.getTracks().forEach((track) => {
      track.enabled = false;
    });
    isMutedRef.current = true;
    setIsMuted(true);
  }, [streamRef]);
  const unmute = useCallback2(() => {
    if (currentAnalyzer.current) {
      currentAnalyzer.current.start();
    }
    streamRef.current?.getTracks().forEach((track) => {
      track.enabled = true;
    });
    isMutedRef.current = false;
    setIsMuted(false);
  }, [streamRef]);
  useEffect(() => {
    return () => {
      try {
        recorder.current?.stop();
        recorder.current?.removeEventListener("dataavailable", dataHandler);
        if (currentAnalyzer.current) {
          currentAnalyzer.current.stop();
          currentAnalyzer.current = null;
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      } catch (e) {
        console.log(e);
      }
    };
  }, [dataHandler, streamRef]);
  useEffect(() => {
    const mimeTypeResult = getSupportedMimeType();
    if (mimeTypeResult.success) {
      mimeTypeRef.current = mimeTypeResult.mimeType;
    } else {
      onError(mimeTypeResult.error.message);
    }
  }, [onError]);
  return {
    start,
    stop,
    mute,
    unmute,
    isMuted,
    fft
  };
};

// src/lib/VoiceProvider.tsx
import {
  createSocketConfig
} from "@humeai/voice";
import {
  createContext,
  useCallback as useCallback7,
  useContext,
  useEffect as useEffect3,
  useMemo,
  useRef as useRef6,
  useState as useState7
} from "react";

// src/lib/noop.ts
var noop = () => {
};

// src/lib/useCallDuration.ts
import { intervalToDuration } from "date-fns";
import { useCallback as useCallback3, useEffect as useEffect2, useRef as useRef3, useState as useState3 } from "react";
var useCallDuration = () => {
  const interval = useRef3(null);
  const startTime = useRef3(null);
  const [timestamp, setTimestamp] = useState3(null);
  const start = useCallback3(() => {
    startTime.current = Date.now();
    setTimestamp("00:00:00");
    interval.current = window.setInterval(() => {
      if (startTime.current) {
        const duration = intervalToDuration({
          start: startTime.current,
          end: Date.now()
        });
        const hours = (duration.hours ?? 0).toString().padStart(2, "0");
        const minutes = (duration.minutes ?? 0).toString().padStart(2, "0");
        const seconds = (duration.seconds ?? 0).toString().padStart(2, "0");
        setTimestamp(`${hours}:${minutes}:${seconds}`);
      }
    }, 500);
  }, []);
  const stop = useCallback3(() => {
    if (interval.current) {
      window.clearInterval(interval.current);
      interval.current = null;
    }
  }, []);
  const reset = useCallback3(() => {
    setTimestamp(null);
  }, []);
  useEffect2(() => {
    return () => {
      if (interval.current) {
        window.clearInterval(interval.current);
        interval.current = null;
      }
    };
  }, []);
  return { timestamp, start, stop, reset };
};

// src/lib/useEncoding.ts
import { checkForAudioTracks, getAudioStream } from "@humeai/voice";
import { useCallback as useCallback4, useRef as useRef4, useState as useState4 } from "react";
var useEncoding = () => {
  const [permission, setPermission] = useState4("prompt");
  const streamRef = useRef4(null);
  const getStream = useCallback4(async () => {
    try {
      const stream = await getAudioStream();
      setPermission("granted");
      streamRef.current = stream;
      checkForAudioTracks(stream);
      return "granted";
    } catch (e) {
      setPermission("denied");
      return "denied";
    }
  }, []);
  return {
    streamRef,
    getStream,
    permission
  };
};

// src/lib/useMessages.ts
import { useCallback as useCallback5, useState as useState5 } from "react";

// src/utils/index.ts
var keepLastN = (n, arr) => {
  if (arr.length <= n) {
    return arr;
  }
  return arr.slice(arr.length - n);
};

// src/lib/useMessages.ts
var useMessages = ({
  sendMessageToParent,
  messageHistoryLimit
}) => {
  const [voiceMessageMap, setVoiceMessageMap] = useState5({});
  const [messages, setMessages] = useState5([]);
  const [lastVoiceMessage, setLastVoiceMessage] = useState5(null);
  const [lastUserMessage, setLastUserMessage] = useState5(null);
  const createConnectMessage = useCallback5(() => {
    setMessages(
      (prev) => prev.concat([
        {
          type: "socket_connected",
          receivedAt: /* @__PURE__ */ new Date()
        }
      ])
    );
  }, []);
  const createDisconnectMessage = useCallback5(() => {
    setMessages(
      (prev) => prev.concat([
        {
          type: "socket_disconnected",
          receivedAt: /* @__PURE__ */ new Date()
        }
      ])
    );
  }, []);
  const onMessage = useCallback5((message) => {
    switch (message.type) {
      case "assistant_message":
        setVoiceMessageMap((prev) => ({
          ...prev,
          [message.id]: message
        }));
        break;
      case "user_message":
        sendMessageToParent?.(message);
        setLastUserMessage(message);
        setMessages((prev) => {
          return keepLastN(messageHistoryLimit, prev.concat([message]));
        });
        break;
      case "user_interruption":
        sendMessageToParent?.(message);
        setMessages((prev) => {
          return keepLastN(messageHistoryLimit, prev.concat([message]));
        });
        break;
      case "error":
        sendMessageToParent?.(message);
        setMessages((prev) => {
          return keepLastN(messageHistoryLimit, prev.concat([message]));
        });
        break;
      default:
        break;
    }
  }, []);
  const onPlayAudio = useCallback5(
    (id) => {
      const matchingTranscript = voiceMessageMap[id];
      if (matchingTranscript) {
        sendMessageToParent?.(matchingTranscript);
        setLastVoiceMessage(matchingTranscript);
        setMessages((prev) => {
          return keepLastN(
            messageHistoryLimit,
            prev.concat([matchingTranscript])
          );
        });
        setVoiceMessageMap((prev) => {
          const newMap = { ...prev };
          delete newMap[id];
          return newMap;
        });
      }
    },
    [voiceMessageMap, sendMessageToParent, messageHistoryLimit]
  );
  const clearMessages = useCallback5(() => {
    setMessages([]);
    setLastVoiceMessage(null);
    setLastUserMessage(null);
    setVoiceMessageMap({});
  }, []);
  return {
    createConnectMessage,
    createDisconnectMessage,
    onMessage,
    onPlayAudio,
    clearMessages,
    messages,
    lastVoiceMessage,
    lastUserMessage
  };
};

// src/lib/useVoiceClient.ts
import { VoiceClient } from "@humeai/voice";
import { useCallback as useCallback6, useRef as useRef5, useState as useState6 } from "react";
var VoiceReadyState = /* @__PURE__ */ ((VoiceReadyState2) => {
  VoiceReadyState2["IDLE"] = "idle";
  VoiceReadyState2["CONNECTING"] = "connecting";
  VoiceReadyState2["OPEN"] = "open";
  VoiceReadyState2["CLOSED"] = "closed";
  return VoiceReadyState2;
})(VoiceReadyState || {});
var useVoiceClient = (props) => {
  const client = useRef5(null);
  const [readyState, setReadyState] = useState6(
    "idle" /* IDLE */
  );
  const onAudioMessage = useRef5(
    props.onAudioMessage
  );
  onAudioMessage.current = props.onAudioMessage;
  const onMessage = useRef5(props.onMessage);
  onMessage.current = props.onMessage;
  const onError = useRef5(props.onError);
  onError.current = props.onError;
  const onOpen = useRef5(props.onOpen);
  onOpen.current = props.onOpen;
  const onClose = useRef5(props.onClose);
  onClose.current = props.onClose;
  const connect = useCallback6((config) => {
    return new Promise((resolve, reject) => {
      client.current = VoiceClient.create(config);
      client.current.on("open", () => {
        onOpen.current?.();
        setReadyState("open" /* OPEN */);
        resolve("open" /* OPEN */);
      });
      client.current.on("message", (message) => {
        if (message.type === "audio_output") {
          onAudioMessage.current?.(message);
        }
        if (message.type === "assistant_message" || message.type === "user_message" || message.type === "user_interruption" || message.type === "error") {
          onMessage.current?.(message);
        }
      });
      client.current.on("close", (event) => {
        onClose.current?.(event);
        setReadyState("closed" /* CLOSED */);
      });
      client.current.on("error", (e) => {
        const message = e instanceof Error ? e.message : "Unknown error";
        onError.current?.(message, e instanceof Error ? e : void 0);
        reject(e);
      });
      setReadyState("connecting" /* CONNECTING */);
      client.current.connect();
    });
  }, []);
  const disconnect = useCallback6(() => {
    setReadyState("idle" /* IDLE */);
    client.current?.disconnect();
  }, []);
  const sendSessionSettings = useCallback6(
    (sessionSettings) => {
      client.current?.sendSessionSettings(sessionSettings);
    },
    []
  );
  const sendAudio = useCallback6((arrayBuffer) => {
    client.current?.sendAudio(arrayBuffer);
  }, []);
  const sendUserInput = useCallback6((text) => {
    client.current?.sendUserInput(text);
  }, []);
  const sendAssistantInput = useCallback6((text) => {
    client.current?.sendAssistantInput(text);
  }, []);
  return {
    readyState,
    sendSessionSettings,
    sendAudio,
    connect,
    disconnect,
    sendUserInput,
    sendAssistantInput
  };
};

// src/lib/VoiceProvider.tsx
import { jsx } from "react/jsx-runtime";
var VoiceContext = createContext(null);
var useVoice = () => {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error("useVoice must be used within an VoiceProvider");
  }
  return ctx;
};
var VoiceProvider = ({
  children,
  clearMessagesOnDisconnect = true,
  messageHistoryLimit = 100,
  sessionSettings,
  ...props
}) => {
  const {
    timestamp: callDurationTimestamp,
    start: startTimer,
    stop: stopTimer
  } = useCallDuration();
  const [status, setStatus] = useState7({
    value: "disconnected"
  });
  const [error, setError] = useState7(null);
  const isError = error !== null;
  const isMicrophoneError = error?.type === "mic_error";
  const isSocketError = error?.type === "socket_error";
  const isAudioError = error?.type === "audio_error";
  const onError = useRef6(props.onError ?? noop);
  onError.current = props.onError ?? noop;
  const onClose = useRef6(props.onClose ?? noop);
  onClose.current = props.onClose ?? noop;
  const messageStore = useMessages({
    sendMessageToParent: props.onMessage,
    messageHistoryLimit
  });
  const updateError = useCallback7((err) => {
    setError(err);
    if (err !== null) {
      onError.current?.(err);
    }
  }, []);
  const onClientError = useCallback7(
    (message, err) => {
      stopTimer();
      updateError({ type: "socket_error", message, error: err });
    },
    [updateError]
  );
  const config = createSocketConfig(props);
  const player = useSoundPlayer({
    onError: (message) => {
      updateError({ type: "audio_error", message });
    },
    onPlayAudio: (id) => {
      messageStore.onPlayAudio(id);
    }
  });
  const { streamRef, getStream, permission: micPermission } = useEncoding();
  const client = useVoiceClient({
    onAudioMessage: (message) => {
      player.addToQueue(message);
    },
    onMessage: useCallback7(
      (message) => {
        messageStore.onMessage(message);
        if (message.type === "user_interruption") {
          player.clearQueue();
        }
      },
      [player]
    ),
    onError: onClientError,
    onOpen: useCallback7(() => {
      startTimer();
      messageStore.createConnectMessage();
      props.onOpen?.();
    }, [messageStore, props, startTimer]),
    onClose: useCallback7(
      (event) => {
        stopTimer();
        messageStore.createDisconnectMessage();
        onClose.current?.(event);
      },
      [messageStore, stopTimer]
    )
  });
  const mic = useMicrophone({
    streamRef,
    onAudioCaptured: useCallback7((arrayBuffer) => {
      try {
        client.sendAudio(arrayBuffer);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        updateError({ type: "socket_error", message });
      }
    }, []),
    onError: useCallback7(
      (message) => {
        updateError({ type: "mic_error", message });
      },
      [updateError]
    )
  });
  const connect = useCallback7(async () => {
    updateError(null);
    setStatus({ value: "connecting" });
    const permission = await getStream();
    if (permission === "denied") {
      const error2 = {
        type: "mic_error",
        message: "Microphone permission denied"
      };
      updateError(error2);
      return Promise.reject(error2);
    }
    try {
      await client.connect({
        ...config
      }).then(() => {
        if (sessionSettings !== void 0 && Object.keys(sessionSettings).length > 0) {
          client.sendSessionSettings(sessionSettings);
        }
      });
    } catch (e) {
      const error2 = {
        type: "socket_error",
        message: "We could not connect to the voice. Please try again."
      };
      updateError(error2);
      return Promise.reject(error2);
    }
    try {
      const [micPromise, playerPromise] = await Promise.allSettled([
        mic.start(),
        player.initPlayer()
      ]);
      if (micPromise.status === "fulfilled" && playerPromise.status === "fulfilled") {
        setStatus({ value: "connected" });
      }
    } catch (e) {
      const error2 = {
        type: "audio_error",
        message: e instanceof Error ? e.message : "We could not connect to audio. Please try again."
      };
      updateError(error2);
    }
  }, [client, config, getStream, mic, player, updateError]);
  const disconnectFromVoice = useCallback7(() => {
    client.disconnect();
    player.stopAll();
    mic.stop();
    if (clearMessagesOnDisconnect) {
      messageStore.clearMessages();
    }
  }, [client, player, mic]);
  const disconnect = useCallback7(
    (disconnectOnError) => {
      if (micPermission === "denied") {
        setStatus({ value: "error", reason: "Microphone permission denied" });
      }
      stopTimer();
      disconnectFromVoice();
      if (status.value !== "error" && !disconnectOnError) {
        setStatus({ value: "disconnected" });
      }
    },
    [micPermission, stopTimer, disconnectFromVoice, status.value]
  );
  useEffect3(() => {
    if (error !== null && status.value !== "error" && status.value !== "disconnected") {
      setStatus({ value: "error", reason: error.message });
      disconnectFromVoice();
    }
  }, [status.value, disconnect, disconnectFromVoice, error]);
  const ctx = useMemo(
    () => ({
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
      sendUserInput: client.sendUserInput,
      sendAssistantInput: client.sendAssistantInput,
      sendSessionSettings: client.sendSessionSettings,
      status,
      unmute: mic.unmute,
      error,
      isAudioError,
      isError,
      isMicrophoneError,
      isSocketError,
      callDurationTimestamp
    }),
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
      client.sendUserInput,
      client.sendAssistantInput,
      client.sendSessionSettings,
      status,
      error,
      isAudioError,
      isError,
      isMicrophoneError,
      isSocketError,
      callDurationTimestamp
    ]
  );
  return /* @__PURE__ */ jsx(VoiceContext.Provider, { value: ctx, children });
};

// src/index.ts
import {
  Channels,
  TTSService,
  AudioEncoding,
  LanguageModelOption
} from "@humeai/voice";
export {
  AudioEncoding,
  Channels,
  LanguageModelOption,
  TTSService,
  VoiceProvider,
  VoiceReadyState,
  useMicrophone,
  useSoundPlayer,
  useVoice,
  useVoiceClient
};
//# sourceMappingURL=index.mjs.map