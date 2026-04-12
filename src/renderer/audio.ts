import { POST_ROLL_SECONDS, PRE_ROLL_SECONDS } from './constants';
import { createLogSweep } from '../shared/audio';
export { encodeWavFile } from '../shared/audio';
import type {
  MeasurementAnalysis,
  MeasurementCapture,
  MeasurementPoint,
} from './types';
import { clamp, wait } from './utils';

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
  const sweep = createLogSweep(
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

export function analyzeMeasurement(
  capture: MeasurementCapture,
  startFrequency: number,
  endFrequency: number,
): MeasurementAnalysis {
  const sweepStartSample = locateSweepStart(capture.recording, capture.sweep);
  const alignedRecording = extractSegment(
    capture.recording,
    sweepStartSample,
    capture.sweep.length,
  );
  const fftSize = nextPowerOfTwo(capture.sweep.length);
  const sourceReal = new Float64Array(fftSize);
  const sourceImag = new Float64Array(fftSize);
  const recordingReal = new Float64Array(fftSize);
  const recordingImag = new Float64Array(fftSize);

  sourceReal.set(capture.sweep);
  recordingReal.set(alignedRecording);

  fft(sourceReal, sourceImag, false);
  fft(recordingReal, recordingImag, false);

  const responseReal = new Float64Array(fftSize / 2);
  const responseImag = new Float64Array(fftSize / 2);
  const epsilon = 1e-12;

  for (let index = 0; index < responseReal.length; index += 1) {
    const denominator =
      sourceReal[index] * sourceReal[index] +
      sourceImag[index] * sourceImag[index] +
      epsilon;

    responseReal[index] =
      (recordingReal[index] * sourceReal[index] +
        recordingImag[index] * sourceImag[index]) /
      denominator;
    responseImag[index] =
      (recordingImag[index] * sourceReal[index] -
        recordingReal[index] * sourceImag[index]) /
      denominator;
  }

  const points = buildMeasurementPoints(
    responseReal,
    responseImag,
    capture.sampleRate,
    fftSize,
    startFrequency,
    endFrequency,
  );

  return {
    sampleRate: capture.sampleRate,
    sweepStartSample,
    latencyMs:
      ((sweepStartSample - capture.preRollSamples) / capture.sampleRate) * 1000,
    recordingLengthSeconds: capture.recording.length / capture.sampleRate,
    peakDbfs: calculatePeakDbfs(alignedRecording),
    rmsDbfs: calculateRmsDbfs(alignedRecording),
    points,
  };
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

function locateSweepStart(recording: Float32Array, sweep: Float32Array): number {
  if (recording.length <= sweep.length) {
    return 0;
  }

  const coarseFactor = Math.max(1, Math.floor(sweep.length / 4096));
  const coarseSweep = decimate(sweep, coarseFactor);
  const coarseRecording = decimate(recording, coarseFactor);
  const coarseOffset = scanForBestOffset(coarseRecording, coarseSweep, 1);
  const approximateOffset = coarseOffset * coarseFactor;
  const searchRadius = coarseFactor * 3;
  const refinedStart = Math.max(0, approximateOffset - searchRadius);
  const refinedEnd = Math.min(
    recording.length - sweep.length,
    approximateOffset + searchRadius,
  );

  return scanForBestOffset(
    recording,
    sweep,
    Math.max(1, Math.floor(sweep.length / 16000)),
    refinedStart,
    refinedEnd,
  );
}

function decimate(source: Float32Array, factor: number): Float32Array {
  const length = Math.ceil(source.length / factor);
  const output = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    output[index] = source[index * factor] ?? 0;
  }

  return output;
}

function scanForBestOffset(
  recording: Float32Array,
  sweep: Float32Array,
  sampleStride: number,
  startOffset = 0,
  endOffset = recording.length - sweep.length,
): number {
  let bestOffset = startOffset;
  let bestScore = Number.NEGATIVE_INFINITY;
  let sweepEnergy = 0;

  for (let index = 0; index < sweep.length; index += sampleStride) {
    const sample = sweep[index];
    sweepEnergy += sample * sample;
  }

  for (let offset = startOffset; offset <= endOffset; offset += 1) {
    let dot = 0;
    let recordingEnergy = 0;

    for (let index = 0; index < sweep.length; index += sampleStride) {
      const recordingSample = recording[offset + index] ?? 0;
      const sweepSample = sweep[index];
      dot += recordingSample * sweepSample;
      recordingEnergy += recordingSample * recordingSample;
    }

    const score = dot / Math.sqrt(recordingEnergy * sweepEnergy + 1e-12);
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  return bestOffset;
}

function extractSegment(
  source: Float32Array,
  start: number,
  length: number,
): Float32Array {
  const output = new Float32Array(length);
  const clampedStart = Math.max(0, start);
  const availableLength = Math.max(0, Math.min(length, source.length - clampedStart));

  output.set(source.subarray(clampedStart, clampedStart + availableLength));
  return output;
}

function nextPowerOfTwo(value: number): number {
  let size = 1;

  while (size < value) {
    size <<= 1;
  }

  return size;
}

function fft(real: Float64Array, imag: Float64Array, inverse: boolean): void {
  const size = real.length;
  let reversedIndex = 0;

  for (let index = 1; index < size; index += 1) {
    let bit = size >> 1;

    while (reversedIndex & bit) {
      reversedIndex ^= bit;
      bit >>= 1;
    }

    reversedIndex ^= bit;

    if (index < reversedIndex) {
      swap(real, index, reversedIndex);
      swap(imag, index, reversedIndex);
    }
  }

  for (let blockSize = 2; blockSize <= size; blockSize <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / blockSize;
    const twiddleReal = Math.cos(angle);
    const twiddleImag = Math.sin(angle);

    for (let blockStart = 0; blockStart < size; blockStart += blockSize) {
      let wReal = 1;
      let wImag = 0;

      for (let offset = 0; offset < blockSize / 2; offset += 1) {
        const evenIndex = blockStart + offset;
        const oddIndex = evenIndex + blockSize / 2;
        const oddReal = real[oddIndex] * wReal - imag[oddIndex] * wImag;
        const oddImag = real[oddIndex] * wImag + imag[oddIndex] * wReal;

        real[oddIndex] = real[evenIndex] - oddReal;
        imag[oddIndex] = imag[evenIndex] - oddImag;
        real[evenIndex] += oddReal;
        imag[evenIndex] += oddImag;

        const nextWReal = wReal * twiddleReal - wImag * twiddleImag;
        wImag = wReal * twiddleImag + wImag * twiddleReal;
        wReal = nextWReal;
      }
    }
  }

  if (inverse) {
    for (let index = 0; index < size; index += 1) {
      real[index] /= size;
      imag[index] /= size;
    }
  }
}

function swap(values: Float64Array, left: number, right: number): void {
  const temporary = values[left];
  values[left] = values[right];
  values[right] = temporary;
}

function buildMeasurementPoints(
  responseReal: Float64Array,
  responseImag: Float64Array,
  sampleRate: number,
  fftSize: number,
  startFrequency: number,
  endFrequency: number,
): MeasurementPoint[] {
  const points: MeasurementPoint[] = [];
  const pointCount = 256;
  const binWidth = sampleRate / fftSize;
  const highestBin = responseReal.length - 1;
  const nyquistLimitedEndFrequency = sampleRate * 0.45;
  const effectiveEndFrequency = Math.min(
    endFrequency * 0.97,
    nyquistLimitedEndFrequency,
  );

  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const position = pointIndex / (pointCount - 1);
    const frequencyHz =
      startFrequency *
      Math.pow(effectiveEndFrequency / startFrequency, position);
    const centerBin = clamp(
      Math.round(frequencyHz / binWidth),
      1,
      highestBin,
    );
    const magnitude = Math.hypot(
      responseReal[centerBin],
      responseImag[centerBin],
    );
    const smoothingWidth = Math.pow(2, 1 / 24);
    const lowBin = clamp(
      Math.floor((frequencyHz / smoothingWidth) / binWidth),
      1,
      highestBin,
    );
    const highBin = clamp(
      Math.ceil((frequencyHz * smoothingWidth) / binWidth),
      1,
      highestBin,
    );
    let powerSum = 0;
    let smoothedRealSum = 0;
    let smoothedImagSum = 0;
    let binCount = 0;

    for (let bin = lowBin; bin <= highBin; bin += 1) {
      const binReal = responseReal[bin];
      const binImag = responseImag[bin];
      const binMagnitude = Math.hypot(binReal, binImag);
      powerSum += binMagnitude * binMagnitude;
      smoothedRealSum += binReal;
      smoothedImagSum += binImag;
      binCount += 1;
    }

    points.push({
      frequencyHz,
      magnitudeDbRelative: 20 * Math.log10(magnitude + 1e-12),
      phaseDegrees:
        (Math.atan2(responseImag[centerBin], responseReal[centerBin]) * 180) /
        Math.PI,
      smoothedMagnitudeDbRelative:
        10 * Math.log10(powerSum / Math.max(1, binCount) + 1e-18),
      smoothedPhaseDegrees:
        (Math.atan2(smoothedImagSum, smoothedRealSum) * 180) / Math.PI,
    });
  }

  return points;
}

function calculatePeakDbfs(samples: Float32Array): number {
  let peak = 0;

  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }

  return 20 * Math.log10(peak + 1e-12);
}

function calculateRmsDbfs(samples: Float32Array): number {
  let sum = 0;

  for (const sample of samples) {
    sum += sample * sample;
  }

  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  return 20 * Math.log10(rms + 1e-12);
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
