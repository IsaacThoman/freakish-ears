import { POST_ROLL_SECONDS, PRE_ROLL_SECONDS } from './constants';
export { analyzeMeasurement } from '../shared/measurement-analysis';
export { encodeWavFile } from '../shared/audio';
import type {
  MeasurementCapture,
} from './types';
import { wait } from './utils';

export async function recordSweepMeasurement(settings: {
  deviceId: string;
  outputDeviceId: string;
  startFrequency: number;
  endFrequency: number;
  durationSeconds: number;
  sweepLevelDb: number;
}): Promise<MeasurementCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: settings.deviceId },
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });

  const audioContext = new AudioContext({ latencyHint: 'interactive' });
  const sampleRate = audioContext.sampleRate;
  const sweep = await renderLogSweep(
    sampleRate,
    settings.durationSeconds,
    settings.startFrequency,
    settings.endFrequency,
  );
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
  const mutedGain = audioContext.createGain();
  const playbackGain = audioContext.createGain();
  const playbackDestination = audioContext.createMediaStreamDestination();
  mutedGain.gain.value = 0;
  playbackGain.gain.value = Math.pow(10, settings.sweepLevelDb / 20);

  const chunks: Float32Array[] = [];
  let sampleCount = 0;

  processorNode.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(input.length);
    copy.set(input);
    chunks.push(copy);
    sampleCount += copy.length;
  };

  sourceNode.connect(processorNode);
  processorNode.connect(mutedGain);
  mutedGain.connect(audioContext.destination);
  playbackGain.connect(playbackDestination);

  const sweepBuffer = audioContext.createBuffer(1, sweep.length, sampleRate);
  sweepBuffer.copyToChannel(sweep, 0);

  const sweepNode = audioContext.createBufferSource();
  sweepNode.buffer = sweepBuffer;
  sweepNode.connect(playbackGain);

  const outputElement = await createOutputPlaybackElement(
    playbackDestination.stream,
    settings.outputDeviceId,
  );

  await audioContext.resume();

  const sweepStartTime = audioContext.currentTime + PRE_ROLL_SECONDS;
  sweepNode.start(sweepStartTime);

  await wait(
    (PRE_ROLL_SECONDS + settings.durationSeconds + POST_ROLL_SECONDS) * 1000 + 120,
  );

  processorNode.disconnect();
  mutedGain.disconnect();
  playbackGain.disconnect();
  sourceNode.disconnect();
  outputElement.pause();
  outputElement.srcObject = null;

  for (const track of stream.getTracks()) {
    track.stop();
  }

  await audioContext.close();

  return {
    recording: flattenChunks(chunks, sampleCount),
    sweep,
    sampleRate,
    preRollSamples: Math.round(PRE_ROLL_SECONDS * sampleRate),
  };
}

async function renderLogSweep(
  sampleRate: number,
  durationSeconds: number,
  startFrequency: number,
  endFrequency: number,
): Promise<Float32Array> {
  const sampleCount = Math.max(1, Math.round(sampleRate * durationSeconds));
  const renderDurationSeconds = sampleCount / sampleRate;
  const fadeSeconds = Math.min(0.02, renderDurationSeconds / 2);
  const offlineContext = new OfflineAudioContext(1, sampleCount, sampleRate);
  const oscillator = offlineContext.createOscillator();
  const gainNode = offlineContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(startFrequency, 0);
  oscillator.frequency.exponentialRampToValueAtTime(
    endFrequency,
    renderDurationSeconds,
  );

  gainNode.gain.setValueAtTime(0, 0);
  if (fadeSeconds > 0) {
    gainNode.gain.linearRampToValueAtTime(1, fadeSeconds);
    gainNode.gain.setValueAtTime(1, Math.max(fadeSeconds, renderDurationSeconds - fadeSeconds));
    gainNode.gain.linearRampToValueAtTime(0, renderDurationSeconds);
  } else {
    gainNode.gain.setValueAtTime(1, 0);
  }

  oscillator.connect(gainNode);
  gainNode.connect(offlineContext.destination);
  oscillator.start(0);
  oscillator.stop(renderDurationSeconds);

  const renderedBuffer = await offlineContext.startRendering();
  const renderedSweep = renderedBuffer.getChannelData(0);
  const sweep = new Float32Array(renderedSweep.length);
  sweep.set(renderedSweep);
  return sweep;
}

function flattenChunks(chunks: Float32Array[], totalLength: number): Float32Array {
  const flattened = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    flattened.set(chunk, offset);
    offset += chunk.length;
  }

  return flattened;
}

async function createOutputPlaybackElement(
  stream: MediaStream,
  outputDeviceId: string,
): Promise<HTMLAudioElement> {
  const audioElement = new Audio();
  const sinkAudioElement = audioElement as HTMLAudioElement & {
    setSinkId?: (sinkId: string) => Promise<void>;
  };

  audioElement.autoplay = true;
  audioElement.volume = 1;
  audioElement.srcObject = stream;

  if (outputDeviceId) {
    if (!sinkAudioElement.setSinkId) {
      throw new Error('Output device selection is not supported on this platform.');
    }

    await sinkAudioElement.setSinkId(outputDeviceId);
  }

  await audioElement.play();
  return audioElement;
}
