import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createLogSweep, encodeWavFile } from '../shared/audio';
import type {
  RunSoxMeasurementPayload,
  RunSoxMeasurementResult,
} from '../shared/ipc';

const SOX_SAMPLE_RATE = 48000;
const SOX_RECORDER_LEAD_IN_MS = 200;

export async function runSoxMeasurement(
  payload: RunSoxMeasurementPayload,
): Promise<RunSoxMeasurementResult> {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'freakish-ears-sox-'));

  try {
    const sweep = scaleSamples(
      createLogSweep(
      SOX_SAMPLE_RATE,
      payload.durationSeconds,
      payload.startFrequency,
      payload.endFrequency,
      ),
      Math.pow(10, payload.sweepLevelDb / 20),
    );
    const sweepPath = path.join(tempDirectory, 'sweep.wav');
    const recordingPath = path.join(tempDirectory, 'recording.wav');

    await writeFile(sweepPath, Buffer.from(encodeWavFile(sweep, SOX_SAMPLE_RATE)));

    const recordingDurationSeconds =
      payload.preRollSeconds + payload.durationSeconds + payload.postRollSeconds + 0.25;

    const recorder = spawnLoggedProcess('sox', [
      '-q',
      '-d',
      '-r',
      String(SOX_SAMPLE_RATE),
      '-c',
      '1',
      '-b',
      '16',
      '-e',
      'signed-integer',
      recordingPath,
      'trim',
      '0',
      recordingDurationSeconds.toFixed(3),
    ]);

    await wait(SOX_RECORDER_LEAD_IN_MS);

    try {
      await runLoggedProcess('sox', ['-q', sweepPath, '-d']);
    } catch (error) {
      recorder.child.kill('SIGTERM');
      await recorder.completion.catch(() => undefined);
      throw error;
    }

    await recorder.completion;

    const recordingWav = new Uint8Array(await readFile(recordingPath));
    const recording = decodeMono16BitPcmWav(recordingWav);

    return {
      recording,
      recordingWav,
      sweep,
      sampleRate: SOX_SAMPLE_RATE,
      preRollSamples: Math.round(payload.preRollSeconds * SOX_SAMPLE_RATE),
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

function decodeMono16BitPcmWav(wavBytes: Uint8Array): Float32Array {
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

  if (channelCount !== 1 || bitsPerSample !== 16 || dataLength <= 0) {
    throw new Error('SoX returned audio that was not mono 16-bit PCM.');
  }

  const sampleCount = Math.floor(dataLength / 2);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = view.getInt16(dataOffset + index * 2, true) / 0x8000;
  }

  return samples;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let text = '';

  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }

  return text;
}

function scaleSamples(samples: Float32Array, gain: number): Float32Array {
  if (gain === 1) {
    return samples;
  }

  const scaled = new Float32Array(samples.length);

  for (let index = 0; index < samples.length; index += 1) {
    scaled[index] = samples[index] * gain;
  }

  return scaled;
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
