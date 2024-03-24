import { type AudioOutputMessage, base64ToBlob } from '@humeai/voice';
import { useCallback, useRef, useState } from 'react';

import { convertLinearFrequenciesToBark } from './convertFrequencyScale';
import { generateEmptyFft } from './generateEmptyFft';

export const useSoundPlayer = (props: {
  onError: (message: string) => void;
  onPlayAudio: (id: string) => void;
}) => {
  const [fft, setFft] = useState<number[]>(generateEmptyFft());

  const audioContext = useRef<AudioContext | null>(null);
  const analyserNode = useRef<AnalyserNode | null>(null);
  const isInitialized = useRef(false);

  const clipQueue = useRef<
    Array<{
      id: string;
      buffer: AudioBuffer;
    }>
  >([]);
  const isProcessing = useRef(false);
  const currentlyPlayingAudioBuffer = useRef<AudioBufferSourceNode | null>(
    null,
  );
  const frequencyDataIntervalId = useRef<NodeJS.Timeout | null>(null);

  const onPlayAudio = useRef<typeof props.onPlayAudio>(props.onPlayAudio);
  onPlayAudio.current = props.onPlayAudio;

  const onError = useRef<typeof props.onError>(props.onError);
  onError.current = props.onError;

  const playNextClip = useCallback(() => {
    if (clipQueue.current.length === 0 || isProcessing.current) {
      return;
    }

    const nextClip = clipQueue.current.shift();
    if (!nextClip) return;

    isProcessing.current = true;

    // Use AudioBufferSourceNode for audio playback. Safari suffered a truncation issue usig HTML5 audio playback
    const bufferSource = audioContext.current!.createBufferSource();
    bufferSource.buffer = nextClip.buffer;

    const bufferSampleRate = bufferSource.buffer.sampleRate;

    bufferSource.connect(analyserNode.current!);

    currentlyPlayingAudioBuffer.current = bufferSource;

    const updateFrequencyData = () => {
      const dataArray = new Uint8Array(analyserNode.current!.frequencyBinCount); // frequencyBinCount is 1/2 of fftSize
      analyserNode.current!.getByteFrequencyData(dataArray); // Using getByteFrequencyData for performance

      const barkFrequencies = convertLinearFrequenciesToBark(
        dataArray,
        bufferSampleRate,
      );

      setFft(() => barkFrequencies);
    };

    frequencyDataIntervalId.current = setInterval(updateFrequencyData, 5);

    bufferSource.start(0);
    onPlayAudio.current(nextClip.id);

    bufferSource.onended = () => {
      if (frequencyDataIntervalId.current) {
        clearInterval(frequencyDataIntervalId.current);
      }
      setFft(generateEmptyFft());
      bufferSource.disconnect();
      isProcessing.current = false;
      currentlyPlayingAudioBuffer.current = null;
      playNextClip();
    };
  }, []);

  const initPlayer = useCallback(() => {
    const initAudioContext = new AudioContext();
    audioContext.current = initAudioContext;

    // Use AnalyserNode to get fft frequency data for visualizations
    const analyser = initAudioContext.createAnalyser();
    analyser.connect(initAudioContext.destination);
    analyser.fftSize = 2048; // Must be a power of 2
    analyserNode.current = analyser;

    isInitialized.current = true;
  }, []);

  const addToQueue = useCallback(
    async (message: AudioOutputMessage) => {
      if (!isInitialized.current || !audioContext.current) {
        onError.current('Audio player has not been initialized');
        return;
      }

      try {
        const blob = base64ToBlob(message.data, 'audio/mp3');
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer =
          await audioContext.current.decodeAudioData(arrayBuffer);

        clipQueue.current.push({
          id: message.id,
          buffer: audioBuffer,
        });

        // playNextClip will iterate the clipQueue upon finishing the playback of the current audio clip, so we can
        // just call playNextClip here if it's the only one in the queue
        if (clipQueue.current.length === 1) {
          playNextClip();
        }
      } catch (e) {
        const eMessage = e instanceof Error ? e.message : 'Unknown error';
        onError.current(`Failed to add clip to queue: ${eMessage}`);
      }
    },
    [playNextClip],
  );

  const stopAll = useCallback(() => {
    isInitialized.current = false;
    isProcessing.current = false;

    if (frequencyDataIntervalId.current) {
      clearInterval(frequencyDataIntervalId.current);
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
    setFft(generateEmptyFft());
  }, []);

  return {
    addToQueue,
    fft,
    initPlayer,
    isPlaying: isProcessing.current,
    stopAll,
    clearQueue,
  };
};
