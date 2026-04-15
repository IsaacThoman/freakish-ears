import { POST_ROLL_SECONDS, PRE_ROLL_SECONDS } from './constants';
export { analyzeMeasurement } from '../shared/measurement-analysis';
export { encodeWavFile } from '../shared/audio';
import type {
  MeasurementChannelSelection,
  MeasurementCapture,
} from './types';
import { wait } from './utils';

export async function recordSweepMeasurement(settings: {
  deviceId: string;
  outputDeviceId: string;
  sampleRate: number;
  inputChannel: MeasurementChannelSelection;
  outputChannel: MeasurementChannelSelection;
  startFrequency: number;
  endFrequency: number;
  durationSeconds: number;
  sweepLevelDb: number;
}): Promise<MeasurementCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: settings.deviceId },
      channelCount: { ideal: 2 },
      sampleRate: { ideal: settings.sampleRate },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  });

  const audioContext = new AudioContext({
    latencyHint: 'playback',
    sampleRate: settings.sampleRate,
  });
  const sinkAudioContext = audioContext as AudioContext & {
    setSinkId?: (sinkId: string) => Promise<void>;
  };

  if (settings.outputDeviceId && sinkAudioContext.setSinkId) {
    await sinkAudioContext.setSinkId(settings.outputDeviceId);
  }

  const sampleRate = audioContext.sampleRate;
  const sweep = await renderLogSweep(
    sampleRate,
    settings.durationSeconds,
    settings.startFrequency,
    settings.endFrequency,
  );
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const processorNode = audioContext.createScriptProcessor(4096, 2, 1);
  const mutedGain = audioContext.createGain();
  const playbackGain = audioContext.createGain();
  mutedGain.gain.value = 0;
  playbackGain.gain.value = Math.pow(10, settings.sweepLevelDb / 20);

  const chunks: Float32Array[] = [];
  let sampleCount = 0;

  processorNode.onaudioprocess = (event) => {
    const copy = selectInputSamples(event.inputBuffer, settings.inputChannel);
    chunks.push(copy);
    sampleCount += copy.length;
  };

  sourceNode.connect(processorNode);
  processorNode.connect(mutedGain);
  mutedGain.connect(audioContext.destination);
  playbackGain.connect(audioContext.destination);

  const sweepBuffer = audioContext.createBuffer(2, sweep.length, sampleRate);
  writeOutputSweepChannels(sweepBuffer, sweep, settings.outputChannel);

  const sweepNode = audioContext.createBufferSource();
  sweepNode.buffer = sweepBuffer;
  sweepNode.connect(playbackGain);

  const outputElement =
    settings.outputDeviceId && !sinkAudioContext.setSinkId
      ? await createOutputPlaybackElement(settings.outputDeviceId)
      : null;

  if (outputElement) {
    playbackGain.disconnect();
    const playbackDestination = audioContext.createMediaStreamDestination();
    playbackGain.connect(playbackDestination);
    outputElement.srcObject = playbackDestination.stream;
    await outputElement.play();
  }

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
  outputElement?.pause();
  if (outputElement) {
    outputElement.srcObject = null;
  }

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

function selectInputSamples(
  inputBuffer: AudioBuffer,
  inputChannel: MeasurementChannelSelection,
): Float32Array {
  const channelCount = inputBuffer.numberOfChannels;
  const frameCount = inputBuffer.length;
  const leftChannel = inputBuffer.getChannelData(0);

  if (channelCount < 2) {
    const fallback = new Float32Array(frameCount);
    fallback.set(leftChannel);
    return fallback;
  }

  const rightChannel = inputBuffer.getChannelData(1);
  if (inputChannel === 'left') {
    const selected = new Float32Array(frameCount);
    selected.set(leftChannel);
    return selected;
  }

  if (inputChannel === 'right') {
    const selected = new Float32Array(frameCount);
    selected.set(rightChannel);
    return selected;
  }

  const mixed = new Float32Array(frameCount);
  for (let index = 0; index < frameCount; index += 1) {
    mixed[index] = (leftChannel[index] + rightChannel[index]) * 0.5;
  }

  return mixed;
}

function writeOutputSweepChannels(
  sweepBuffer: AudioBuffer,
  sweep: Float32Array,
  outputChannel: MeasurementChannelSelection,
): void {
  const left = new Float32Array(sweep.length);
  const right = new Float32Array(sweep.length);

  if (outputChannel === 'left' || outputChannel === 'both') {
    left.set(sweep);
  }

  if (outputChannel === 'right' || outputChannel === 'both') {
    right.set(sweep);
  }

  sweepBuffer.copyToChannel(left, 0);
  sweepBuffer.copyToChannel(right, 1);
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
  outputDeviceId: string,
): Promise<HTMLAudioElement> {
  const audioElement = new Audio();
  const sinkAudioElement = audioElement as HTMLAudioElement & {
    setSinkId?: (sinkId: string) => Promise<void>;
  };

  audioElement.autoplay = true;
  audioElement.volume = 1;

  if (outputDeviceId) {
    if (!sinkAudioElement.setSinkId) {
      throw new Error('Output device selection is not supported on this platform.');
    }

    await sinkAudioElement.setSinkId(outputDeviceId);
  }

  return audioElement;
}
