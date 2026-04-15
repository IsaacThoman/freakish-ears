import { POST_ROLL_SECONDS, PRE_ROLL_SECONDS } from './constants';
export { analyzeMeasurement } from '../shared/measurement-analysis';
export { encodeWavFile } from '../shared/audio';
import { encodeMultichannelWavFile } from '../shared/audio';
import type {
  MeasurementChannelSelection,
  MeasurementCapture,
} from './types';
import { wait } from './utils';

const OUTPUT_PLAYBACK_WARMUP_MS = 200;
const AUDIO_CONTEXT_RESUME_TIMEOUT_MS = 500;

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
    latencyHint: 'interactive',
    sampleRate: settings.sampleRate,
  });

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
  mutedGain.gain.value = 0;
  const captureStartedAtMs = performance.now();

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

  const playbackSweep = padSweepWithLeadingSilence(
    applySweepGain(sweep, settings.sweepLevelDb),
    sampleRate,
    OUTPUT_PLAYBACK_WARMUP_MS / 1000,
  );
  const outputElement = await createOutputPlaybackElement(
    playbackSweep,
    sampleRate,
    settings.outputChannel,
    settings.outputDeviceId,
  );

  await audioContext.resume();
  await waitForAudioContextRunning(audioContext);
  await outputElement.play();
  await waitForPlaybackStart(outputElement);

  const actualPreRollSamples = Math.round(
    (((performance.now() - captureStartedAtMs) / 1000) + PRE_ROLL_SECONDS) * sampleRate +
      (playbackSweep.length - sweep.length),
  );

  await wait(
    PRE_ROLL_SECONDS * 1000 +
      (playbackSweep.length / sampleRate) * 1000 +
      POST_ROLL_SECONDS * 1000 +
      120,
  );

  processorNode.disconnect();
  mutedGain.disconnect();
  sourceNode.disconnect();
  outputElement.pause();
  outputElement.srcObject = null;
  clearPlaybackSource(outputElement);

  for (const track of stream.getTracks()) {
    track.stop();
  }

  await audioContext.close();

  return {
    recording: flattenChunks(chunks, sampleCount),
    sweep,
    sampleRate,
    preRollSamples: actualPreRollSamples,
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

function createPlaybackChannels(
  sweep: Float32Array,
  outputChannel: MeasurementChannelSelection,
): Float32Array[] {
  const left = new Float32Array(sweep.length);
  const right = new Float32Array(sweep.length);

  if (outputChannel === 'left' || outputChannel === 'both') {
    left.set(sweep);
  }

  if (outputChannel === 'right' || outputChannel === 'both') {
    right.set(sweep);
  }

  return [left, right];
}

function padSweepWithLeadingSilence(
  sweep: Float32Array,
  sampleRate: number,
  silenceSeconds: number,
): Float32Array {
  const silenceSampleCount = Math.max(0, Math.round(sampleRate * silenceSeconds));

  if (silenceSampleCount === 0) {
    return sweep;
  }

  const padded = new Float32Array(sweep.length + silenceSampleCount);
  padded.set(sweep, silenceSampleCount);
  return padded;
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
  sweep: Float32Array,
  sampleRate: number,
  outputChannel: MeasurementChannelSelection,
  outputDeviceId: string,
): Promise<HTMLAudioElement> {
  const audioElement = new Audio();
  const sinkAudioElement = audioElement as HTMLAudioElement & {
    setSinkId?: (sinkId: string) => Promise<void>;
  };

  audioElement.autoplay = true;
  audioElement.volume = 1;
  audioElement.src = URL.createObjectURL(new Blob([
    encodeMultichannelWavFile(createPlaybackChannels(sweep, outputChannel), sampleRate),
  ], { type: 'audio/wav' }));

  if (outputDeviceId) {
    if (!sinkAudioElement.setSinkId) {
      throw new Error('Output device selection is not supported on this platform.');
    }

    await sinkAudioElement.setSinkId(outputDeviceId);
  }

  return audioElement;
}

function clearPlaybackSource(audioElement: HTMLAudioElement): void {
  if (!audioElement.src.startsWith('blob:')) {
    return;
  }

  URL.revokeObjectURL(audioElement.src);
  audioElement.removeAttribute('src');
  audioElement.load();
}

function applySweepGain(sweep: Float32Array, sweepLevelDb: number): Float32Array {
  const amplitude = Math.pow(10, sweepLevelDb / 20);
  const scaled = new Float32Array(sweep.length);

  for (let index = 0; index < sweep.length; index += 1) {
    scaled[index] = sweep[index] * amplitude;
  }

  return scaled;
}

async function waitForPlaybackStart(audioElement: HTMLAudioElement): Promise<void> {
  if (!audioElement.paused && audioElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      audioElement.removeEventListener('playing', handleReady);
      audioElement.removeEventListener('canplay', handleReady);
      window.clearTimeout(timeoutId);
      resolve();
    };

    const handleReady = () => {
      finish();
    };

    const timeoutId = window.setTimeout(finish, 500);

    audioElement.addEventListener('playing', handleReady, { once: true });
    audioElement.addEventListener('canplay', handleReady, { once: true });
  });
}

async function waitForAudioContextRunning(audioContext: AudioContext): Promise<void> {
  if (audioContext.state === 'running') {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      audioContext.removeEventListener('statechange', handleStateChange);
      window.clearTimeout(timeoutId);
      resolve();
    };

    const handleStateChange = () => {
      if (audioContext.state === 'running') {
        finish();
      }
    };

    const timeoutId = window.setTimeout(finish, AUDIO_CONTEXT_RESUME_TIMEOUT_MS);

    audioContext.addEventListener('statechange', handleStateChange);
  });
}
