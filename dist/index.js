'use client';
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  AudioEncoding: () => import_voice6.AudioEncoding,
  Channels: () => import_voice6.Channels,
  LanguageModelOption: () => import_voice6.LanguageModelOption,
  TTSService: () => import_voice6.TTSService,
  VoiceProvider: () => VoiceProvider,
  VoiceReadyState: () => VoiceReadyState,
  useMicrophone: () => useMicrophone,
  useSoundPlayer: () => useSoundPlayer,
  useVoice: () => useVoice,
  useVoiceClient: () => useVoiceClient
});
module.exports = __toCommonJS(src_exports);

// src/lib/useSoundPlayer.ts
var import_voice = require("@humeai/voice");
var import_react = require("react");

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
  const [isPlaying, setIsPlaying] = (0, import_react.useState)(false);
  const [fft, setFft] = (0, import_react.useState)(generateEmptyFft());
  const audioContext = (0, import_react.useRef)(null);
  const analyserNode = (0, import_react.useRef)(null);
  const isInitialized = (0, import_react.useRef)(false);
  const clipQueue = (0, import_react.useRef)([]);
  const isProcessing = (0, import_react.useRef)(false);
  const currentlyPlayingAudioBuffer = (0, import_react.useRef)(
    null
  );
  const frequencyDataIntervalId = (0, import_react.useRef)(null);
  const onPlayAudio = (0, import_react.useRef)(props.onPlayAudio);
  onPlayAudio.current = props.onPlayAudio;
  const onError = (0, import_react.useRef)(props.onError);
  onError.current = props.onError;
  const playNextClip = (0, import_react.useCallback)(() => {
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
  const initPlayer = (0, import_react.useCallback)(() => {
    const initAudioContext = new AudioContext();
    audioContext.current = initAudioContext;
    const analyser = initAudioContext.createAnalyser();
    analyser.connect(initAudioContext.destination);
    analyser.fftSize = 2048;
    analyserNode.current = analyser;
    isInitialized.current = true;
  }, []);
  const addToQueue = (0, import_react.useCallback)(
    async (message) => {
      if (!isInitialized.current || !audioContext.current) {
        onError.current("Audio player has not been initialized");
        return;
      }
      try {
        const blob = (0, import_voice.base64ToBlob)(message.data, "audio/mp3");
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
  const stopAll = (0, import_react.useCallback)(() => {
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
  const clearQueue = (0, import_react.useCallback)(() => {
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
var import_voice2 = require("@humeai/voice");
var import_meyda = __toESM(require("meyda"));
var import_react2 = require("react");
var useMicrophone = (props) => {
  const { streamRef, onAudioCaptured, onError } = props;
  const [isMuted, setIsMuted] = (0, import_react2.useState)(false);
  const isMutedRef = (0, import_react2.useRef)(isMuted);
  const [fft, setFft] = (0, import_react2.useState)(generateEmptyFft());
  const currentAnalyzer = (0, import_react2.useRef)(null);
  const mimeTypeRef = (0, import_react2.useRef)(null);
  const audioContext = (0, import_react2.useRef)(null);
  const recorder = (0, import_react2.useRef)(null);
  const sendAudio = (0, import_react2.useRef)(onAudioCaptured);
  sendAudio.current = onAudioCaptured;
  const dataHandler = (0, import_react2.useCallback)((event) => {
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
  const start = (0, import_react2.useCallback)(() => {
    const stream = streamRef.current;
    if (!stream) {
      throw new Error("No stream connected");
    }
    const context = new AudioContext();
    audioContext.current = context;
    const input = context.createMediaStreamSource(stream);
    try {
      currentAnalyzer.current = import_meyda.default.createMeydaAnalyzer({
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
  const stop = (0, import_react2.useCallback)(() => {
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
  const mute = (0, import_react2.useCallback)(() => {
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
  const unmute = (0, import_react2.useCallback)(() => {
    if (currentAnalyzer.current) {
      currentAnalyzer.current.start();
    }
    streamRef.current?.getTracks().forEach((track) => {
      track.enabled = true;
    });
    isMutedRef.current = false;
    setIsMuted(false);
  }, [streamRef]);
  (0, import_react2.useEffect)(() => {
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
  (0, import_react2.useEffect)(() => {
    const mimeTypeResult = (0, import_voice2.getSupportedMimeType)();
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
var import_voice5 = require("@humeai/voice");
var import_react7 = require("react");

// src/lib/noop.ts
var noop = () => {
};

// src/lib/useCallDuration.ts
var import_date_fns = require("date-fns");
var import_react3 = require("react");
var useCallDuration = () => {
  const interval = (0, import_react3.useRef)(null);
  const startTime = (0, import_react3.useRef)(null);
  const [timestamp, setTimestamp] = (0, import_react3.useState)(null);
  const start = (0, import_react3.useCallback)(() => {
    startTime.current = Date.now();
    setTimestamp("00:00:00");
    interval.current = window.setInterval(() => {
      if (startTime.current) {
        const duration = (0, import_date_fns.intervalToDuration)({
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
  const stop = (0, import_react3.useCallback)(() => {
    if (interval.current) {
      window.clearInterval(interval.current);
      interval.current = null;
    }
  }, []);
  const reset = (0, import_react3.useCallback)(() => {
    setTimestamp(null);
  }, []);
  (0, import_react3.useEffect)(() => {
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
var import_voice3 = require("@humeai/voice");
var import_react4 = require("react");
var useEncoding = () => {
  const [permission, setPermission] = (0, import_react4.useState)("prompt");
  const streamRef = (0, import_react4.useRef)(null);
  const getStream = (0, import_react4.useCallback)(async () => {
    try {
      const stream = await (0, import_voice3.getAudioStream)();
      setPermission("granted");
      streamRef.current = stream;
      (0, import_voice3.checkForAudioTracks)(stream);
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
var import_react5 = require("react");

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
  const [voiceMessageMap, setVoiceMessageMap] = (0, import_react5.useState)({});
  const [messages, setMessages] = (0, import_react5.useState)([]);
  const [lastVoiceMessage, setLastVoiceMessage] = (0, import_react5.useState)(null);
  const [lastUserMessage, setLastUserMessage] = (0, import_react5.useState)(null);
  const createConnectMessage = (0, import_react5.useCallback)(() => {
    setMessages(
      (prev) => prev.concat([
        {
          type: "socket_connected",
          receivedAt: /* @__PURE__ */ new Date()
        }
      ])
    );
  }, []);
  const createDisconnectMessage = (0, import_react5.useCallback)(() => {
    setMessages(
      (prev) => prev.concat([
        {
          type: "socket_disconnected",
          receivedAt: /* @__PURE__ */ new Date()
        }
      ])
    );
  }, []);
  const onMessage = (0, import_react5.useCallback)((message) => {
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
  const onPlayAudio = (0, import_react5.useCallback)(
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
  const clearMessages = (0, import_react5.useCallback)(() => {
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
var import_voice4 = require("@humeai/voice");
var import_react6 = require("react");
var VoiceReadyState = /* @__PURE__ */ ((VoiceReadyState2) => {
  VoiceReadyState2["IDLE"] = "idle";
  VoiceReadyState2["CONNECTING"] = "connecting";
  VoiceReadyState2["OPEN"] = "open";
  VoiceReadyState2["CLOSED"] = "closed";
  return VoiceReadyState2;
})(VoiceReadyState || {});
var useVoiceClient = (props) => {
  const client = (0, import_react6.useRef)(null);
  const [readyState, setReadyState] = (0, import_react6.useState)(
    "idle" /* IDLE */
  );
  const onAudioMessage = (0, import_react6.useRef)(
    props.onAudioMessage
  );
  onAudioMessage.current = props.onAudioMessage;
  const onMessage = (0, import_react6.useRef)(props.onMessage);
  onMessage.current = props.onMessage;
  const onError = (0, import_react6.useRef)(props.onError);
  onError.current = props.onError;
  const onOpen = (0, import_react6.useRef)(props.onOpen);
  onOpen.current = props.onOpen;
  const onClose = (0, import_react6.useRef)(props.onClose);
  onClose.current = props.onClose;
  const connect = (0, import_react6.useCallback)((config) => {
    return new Promise((resolve, reject) => {
      client.current = import_voice4.VoiceClient.create(config);
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
  const disconnect = (0, import_react6.useCallback)(() => {
    setReadyState("idle" /* IDLE */);
    client.current?.disconnect();
  }, []);
  const sendSessionSettings = (0, import_react6.useCallback)(
    (sessionSettings) => {
      client.current?.sendSessionSettings(sessionSettings);
    },
    []
  );
  const sendAudio = (0, import_react6.useCallback)((arrayBuffer) => {
    client.current?.sendAudio(arrayBuffer);
  }, []);
  const sendUserInput = (0, import_react6.useCallback)((text) => {
    client.current?.sendUserInput(text);
  }, []);
  const sendAssistantInput = (0, import_react6.useCallback)((text) => {
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
var import_jsx_runtime = require("react/jsx-runtime");
var VoiceContext = (0, import_react7.createContext)(null);
var useVoice = () => {
  const ctx = (0, import_react7.useContext)(VoiceContext);
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
  const [status, setStatus] = (0, import_react7.useState)({
    value: "disconnected"
  });
  const [error, setError] = (0, import_react7.useState)(null);
  const isError = error !== null;
  const isMicrophoneError = error?.type === "mic_error";
  const isSocketError = error?.type === "socket_error";
  const isAudioError = error?.type === "audio_error";
  const onError = (0, import_react7.useRef)(props.onError ?? noop);
  onError.current = props.onError ?? noop;
  const onClose = (0, import_react7.useRef)(props.onClose ?? noop);
  onClose.current = props.onClose ?? noop;
  const messageStore = useMessages({
    sendMessageToParent: props.onMessage,
    messageHistoryLimit
  });
  const updateError = (0, import_react7.useCallback)((err) => {
    setError(err);
    if (err !== null) {
      onError.current?.(err);
    }
  }, []);
  const onClientError = (0, import_react7.useCallback)(
    (message, err) => {
      stopTimer();
      updateError({ type: "socket_error", message, error: err });
    },
    [updateError]
  );
  const config = (0, import_voice5.createSocketConfig)(props);
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
    onMessage: (0, import_react7.useCallback)(
      (message) => {
        messageStore.onMessage(message);
        if (message.type === "user_interruption") {
          player.clearQueue();
        }
      },
      [player]
    ),
    onError: onClientError,
    onOpen: (0, import_react7.useCallback)(() => {
      startTimer();
      messageStore.createConnectMessage();
      props.onOpen?.();
    }, [messageStore, props, startTimer]),
    onClose: (0, import_react7.useCallback)(
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
    onAudioCaptured: (0, import_react7.useCallback)((arrayBuffer) => {
      try {
        client.sendAudio(arrayBuffer);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        updateError({ type: "socket_error", message });
      }
    }, []),
    onError: (0, import_react7.useCallback)(
      (message) => {
        updateError({ type: "mic_error", message });
      },
      [updateError]
    )
  });
  const connect = (0, import_react7.useCallback)(async () => {
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
  const disconnectFromVoice = (0, import_react7.useCallback)(() => {
    client.disconnect();
    player.stopAll();
    mic.stop();
    if (clearMessagesOnDisconnect) {
      messageStore.clearMessages();
    }
  }, [client, player, mic]);
  const disconnect = (0, import_react7.useCallback)(
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
  (0, import_react7.useEffect)(() => {
    if (error !== null && status.value !== "error" && status.value !== "disconnected") {
      setStatus({ value: "error", reason: error.message });
      disconnectFromVoice();
    }
  }, [status.value, disconnect, disconnectFromVoice, error]);
  const ctx = (0, import_react7.useMemo)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoiceContext.Provider, { value: ctx, children });
};

// src/index.ts
var import_voice6 = require("@humeai/voice");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
});
//# sourceMappingURL=index.js.map