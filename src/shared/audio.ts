export const DEFAULT_SWEEP_AMPLITUDE = 0.72;

export function createLogSweep(
  sampleRate: number,
  durationSeconds: number,
  startFrequency: number,
  endFrequency: number,
  amplitude = DEFAULT_SWEEP_AMPLITUDE,
): Float32Array {
  const length = Math.max(1, Math.round(sampleRate * durationSeconds));
  const sweep = new Float32Array(length);
  const ratio = endFrequency / startFrequency;
  const phaseScale =
    (2 * Math.PI * startFrequency * durationSeconds) / Math.log(ratio);
  const fadeSampleCount = Math.max(32, Math.round(sampleRate * 0.02));

  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    const exponentialTerm = Math.pow(ratio, time / durationSeconds);
    let sample = Math.sin(phaseScale * (exponentialTerm - 1));

    if (index < fadeSampleCount) {
      sample *= 0.5 - 0.5 * Math.cos((Math.PI * index) / fadeSampleCount);
    }

    const fadeOutIndex = length - index - 1;
    if (fadeOutIndex < fadeSampleCount) {
      sample *= 0.5 - 0.5 * Math.cos((Math.PI * fadeOutIndex) / fadeSampleCount);
    }

    sweep[index] = sample * amplitude;
  }

  return sweep;
}

export function encodeWavFile(
  samples: Float32Array,
  sampleRate: number,
): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}
