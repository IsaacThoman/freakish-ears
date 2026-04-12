import { spawn } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type {
  MeasurementAnalysis,
  MeasurementCapture,
} from '../shared/ipc';

export async function analyzeMeasurement(
  capture: MeasurementCapture,
  startFrequency: number,
  endFrequency: number,
): Promise<MeasurementAnalysis> {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'freakish-ears-analysis-'));

  try {
    const recordingPath = path.join(tempDirectory, 'recording.f32');
    const sweepPath = path.join(tempDirectory, 'sweep.f32');
    const pythonPath = await resolvePythonPath();
    const scriptPath = path.resolve(
      process.cwd(),
      'src',
      'main',
      'python',
      'measurement_analysis.py',
    );

    await writeFile(recordingPath, float32ArrayToBuffer(capture.recording));
    await writeFile(sweepPath, float32ArrayToBuffer(capture.sweep));

    const stdout = await runPythonAnalysis(pythonPath, scriptPath, [
      '--recording',
      recordingPath,
      '--sweep',
      sweepPath,
      '--sample-rate',
      String(capture.sampleRate),
      '--pre-roll-samples',
      String(capture.preRollSamples),
      '--start-frequency',
      String(startFrequency),
      '--end-frequency',
      String(endFrequency),
    ]);

    return JSON.parse(stdout) as MeasurementAnalysis;
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function resolvePythonPath(): Promise<string> {
  const candidatePaths = [
    path.resolve(process.cwd(), '.venv', 'bin', 'python3'),
    path.resolve(process.cwd(), '.venv', 'bin', 'python'),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      await access(candidatePath, fsConstants.X_OK);
      return candidatePath;
    } catch {
      // Keep looking.
    }
  }

  throw new Error('Python virtualenv was not found. Expected .venv/bin/python3.');
}

function float32ArrayToBuffer(values: Float32Array): Buffer {
  return Buffer.from(values.buffer, values.byteOffset, values.byteLength);
}

async function runPythonAnalysis(
  pythonPath: string,
  scriptPath: string,
  args: string[],
): Promise<string> {
  const child = spawn(pythonPath, [scriptPath, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  child.stdout?.on('data', (chunk: Buffer | string) => {
    stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  child.stderr?.on('data', (chunk: Buffer | string) => {
    stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const details = Buffer.concat(stderrChunks).toString().trim();
      reject(new Error(details || `Python analysis exited with code ${String(code)}.`));
    });
  });

  return Buffer.concat(stdoutChunks).toString();
}
