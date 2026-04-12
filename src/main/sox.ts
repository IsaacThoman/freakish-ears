import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { encodeMultichannelWavFile } from '../shared/audio';
import type {
  MeasurementChannelSelection,
  RunSoxMeasurementPayload,
  RunSoxMeasurementResult,
} from '../shared/ipc';

const SOX_RECORDER_LEAD_IN_MS = 200;
const SOX_WAVEAUDIO_DEVICE = 'default';

export async function runSoxMeasurement(
  payload: RunSoxMeasurementPayload,
): Promise<RunSoxMeasurementResult> {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'freakish-ears-sox-'));

  try {
    const sweepPath = path.join(tempDirectory, 'sweep.wav');
    const recordingPath = path.join(tempDirectory, 'recording.wav');
    await synthesizeSweepWav(sweepPath, payload);

    const recordingDurationSeconds =
      payload.preRollSeconds + payload.durationSeconds + payload.postRollSeconds + 0.25;

    const recorder = spawnLoggedProcess('sox', [
      '-q',
        '-t',
        'waveaudio',
        SOX_WAVEAUDIO_DEVICE,
        '-r',
        String(payload.sampleRate),
        '-c',
        '2',
        '-b',
        '16',
        '-e',
      'signed-integer',
      recordingPath,
      'trim',
      '0',
      recordingDurationSeconds.toFixed(3),
    ]);

    await wait(
      Math.max(
        SOX_RECORDER_LEAD_IN_MS,
        Math.round(payload.preRollSeconds * 1000),
      ),
    );

    try {
      await runLoggedProcess('sox', [
        '-q',
        sweepPath,
        '-t',
        'waveaudio',
        SOX_WAVEAUDIO_DEVICE,
      ]);
    } catch (error) {
      recorder.child.kill('SIGTERM');
      await recorder.completion.catch(() => undefined);
      throw error;
    }

    await recorder.completion;

    const sweepWav = new Uint8Array(await readFile(sweepPath));
    const sweep = selectChannelSamples(
      decode16BitPcmWavChannels(sweepWav),
      payload.outputChannel,
    );
    const recordingWav = new Uint8Array(await readFile(recordingPath));
    const recording = selectChannelSamples(
      decode16BitPcmWavChannels(recordingWav),
      payload.inputChannel,
    );

    return {
      recording,
      recordingWav,
      sweep,
      sampleRate: payload.sampleRate,
      preRollSamples: Math.round(payload.preRollSeconds * payload.sampleRate),
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function synthesizeSweepWav(
  sweepPath: string,
  payload: RunSoxMeasurementPayload,
): Promise<void> {
  const monoSweep = renderLogSweep(
    payload.sampleRate,
    payload.durationSeconds,
    payload.startFrequency,
    payload.endFrequency,
    payload.sweepLevelDb,
  );
  const channels = createOutputChannels(monoSweep, payload.outputChannel);
  const wavBytes = encodeMultichannelWavFile(channels, payload.sampleRate);
  await writeFile(sweepPath, wavBytes);
}

function decode16BitPcmWavChannels(wavBytes: Uint8Array): Float32Array[] {
  const view = new DataView(
    wavBytes.buffer,
    wavBytes.byteOffset,
    wavBytes.byteLength,
  );

  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
    throw new Error('SoX returned an invalid WAV file.');
  }

  let offset = 12;
  let channelCount = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= view.byteLength) {
    const chunkId = readAscii(view, offset, 4);
    const chunkLength = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === 'fmt ') {
      const audioFormat = view.getUint16(chunkDataOffset, true);
      channelCount = view.getUint16(chunkDataOffset + 2, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);

      if (audioFormat !== 1) {
        throw new Error('SoX returned a WAV file in an unsupported format.');
      }
    }

    if (chunkId === 'data') {
      dataOffset = chunkDataOffset;
      dataLength = chunkLength;
      break;
    }

    offset = chunkDataOffset + chunkLength + (chunkLength % 2);
  }

  if (channelCount < 1 || channelCount > 2 || bitsPerSample !== 16 || dataLength <= 0) {
    throw new Error('SoX returned audio that was not 16-bit PCM mono/stereo.');
  }

  const sampleCount = Math.floor(dataLength / (2 * channelCount));
  const channels = Array.from({ length: channelCount }, () => new Float32Array(sampleCount));

  let sampleOffset = dataOffset;
  for (let index = 0; index < sampleCount; index += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      channels[channelIndex][index] = view.getInt16(sampleOffset, true) / 0x8000;
      sampleOffset += 2;
    }
  }

  return channels;
}

function selectChannelSamples(
  channels: Float32Array[],
  selection: MeasurementChannelSelection,
): Float32Array {
  const left = channels[0];
  const right = channels[1] ?? channels[0];

  if (!left) {
    throw new Error('Captured audio did not contain any usable channels.');
  }

  if (selection === 'left') {
    return left;
  }

  if (selection === 'right') {
    return right;
  }

  const mixed = new Float32Array(left.length);
  for (let index = 0; index < left.length; index += 1) {
    mixed[index] = (left[index] + right[index]) * 0.5;
  }

  return mixed;
}

function renderLogSweep(
  sampleRate: number,
  durationSeconds: number,
  startFrequency: number,
  endFrequency: number,
  sweepLevelDb: number,
): Float32Array {
  const sampleCount = Math.max(1, Math.round(sampleRate * durationSeconds));
  const renderDurationSeconds = sampleCount / sampleRate;
  const fadeSeconds = Math.min(0.02, renderDurationSeconds / 2);
  const amplitude = Math.pow(10, sweepLevelDb / 20);
  const sweep = new Float32Array(sampleCount);
  const frequencyRatio = endFrequency / startFrequency;
  const sweepScale = renderDurationSeconds / Math.log(frequencyRatio);
  const phaseScale = 2 * Math.PI * startFrequency * sweepScale;

  for (let index = 0; index < sampleCount; index += 1) {
    const timeSeconds = index / sampleRate;
    const phase = phaseScale * (Math.pow(frequencyRatio, timeSeconds / renderDurationSeconds) - 1);
    let fadeGain = 1;

    if (fadeSeconds > 0 && timeSeconds < fadeSeconds) {
      fadeGain = timeSeconds / fadeSeconds;
    } else if (fadeSeconds > 0 && timeSeconds > renderDurationSeconds - fadeSeconds) {
      fadeGain = Math.max(0, (renderDurationSeconds - timeSeconds) / fadeSeconds);
    }

    sweep[index] = Math.sin(phase) * amplitude * fadeGain;
  }

  return sweep;
}

function createOutputChannels(
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

function readAscii(view: DataView, offset: number, length: number): string {
  let text = '';

  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }

  return text;
}

function spawnLoggedProcess(command: string, args: string[]): {
  child: ReturnType<typeof spawn>;
  completion: Promise<void>;
} {
  const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });

  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  const completion = new Promise<void>((resolve, reject) => {
    child.once('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('SoX is not installed or is not available on PATH.'));
        return;
      }

      reject(error);
    });

    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const details = stderr.trim();
      reject(
        new Error(
          details ||
            `${command} exited with ${signal ? `signal ${signal}` : `code ${String(code)}`}.`,
        ),
      );
    });
  });

  return { child, completion };
}

async function runLoggedProcess(command: string, args: string[]): Promise<void> {
  const process = spawnLoggedProcess(command, args);
  await process.completion;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
