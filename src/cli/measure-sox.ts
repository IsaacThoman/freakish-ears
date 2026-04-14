import { saveMeasurementSession } from '../main/files';
import { runSoxMeasurement } from '../main/sox';
import { POST_ROLL_SECONDS, PRE_ROLL_SECONDS } from '../renderer/constants';
import { encodeWavFile } from '../shared/audio';
import {
  buildMeasurementCsv,
  buildMeasurementJson,
} from '../renderer/measurements';
import { analyzeMeasurement } from '../shared/measurement-analysis';

type CliOptions = {
  outputFolder: string;
  startFrequency: number;
  endFrequency: number;
  durationSeconds: number;
  sweepLevelDb: number;
  sampleRate: number;
  inputChannel: 'left' | 'right' | 'both';
  outputChannel: 'left' | 'right' | 'both';
  repeat: number;
  pauseMs: number;
};

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));

  for (let runIndex = 0; runIndex < options.repeat; runIndex += 1) {
    const measurementNumber = runIndex + 1;
    console.log(
      `[autocal] Starting scripted SoX measurement ${measurementNumber}/${options.repeat}`,
    );

    const capture = await runSoxMeasurement({
      startFrequency: options.startFrequency,
      endFrequency: options.endFrequency,
      durationSeconds: options.durationSeconds,
      sweepLevelDb: options.sweepLevelDb,
      sampleRate: options.sampleRate,
      inputChannel: options.inputChannel,
      outputChannel: options.outputChannel,
      preRollSeconds: PRE_ROLL_SECONDS,
      postRollSeconds: POST_ROLL_SECONDS,
    });
    const analysis = analyzeMeasurement(
      {
        recording: capture.recording,
        sweep: capture.sweep,
        sampleRate: capture.sampleRate,
        preRollSamples: capture.preRollSamples,
      },
      options.startFrequency,
      options.endFrequency,
    );
    const sessionName =
      options.repeat === 1
        ? `measurement-${formatTimestampForPath(new Date())}`
        : `measurement-${formatTimestampForPath(new Date())}-${String(measurementNumber).padStart(2, '0')}`;

    const measurementJson = buildMeasurementJson({
      analysis,
      capture: {
        recording: capture.recording,
      },
      microphoneLabel: 'System default (SoX)',
      outputDeviceLabel: 'System default (SoX)',
      settings: {
        backend: 'sox',
        startFrequency: options.startFrequency,
        endFrequency: options.endFrequency,
        durationSeconds: options.durationSeconds,
        sweepLevelDb: options.sweepLevelDb,
        sampleRate: options.sampleRate,
        inputChannel: options.inputChannel,
        outputChannel: options.outputChannel,
      },
      preRollSeconds: PRE_ROLL_SECONDS,
      postRollSeconds: POST_ROLL_SECONDS,
      splOffsetDb: 0,
    });
    const measurementCsv = buildMeasurementCsv(analysis.points);
    const saveResult = await saveMeasurementSession({
      folderPath: options.outputFolder,
      sessionName,
      files: [
        {
          name: 'recording.wav',
          contents: encodeWavFile(capture.recording, capture.sampleRate),
        },
        {
          name: 'values.csv',
          contents: new TextEncoder().encode(measurementCsv),
        },
        {
          name: 'values.json',
          contents: new TextEncoder().encode(measurementJson),
        },
      ],
    });

    console.log(
      JSON.stringify({
        sessionDirectory: saveResult.sessionDirectory,
        sampleRate: analysis.sampleRate,
        latencyMs: Number(analysis.latencyMs.toFixed(3)),
        peakDbfs: Number(analysis.peakDbfs.toFixed(3)),
        rmsDbfs: Number(analysis.rmsDbfs.toFixed(3)),
      }),
    );

    if (measurementNumber < options.repeat && options.pauseMs > 0) {
      await wait(options.pauseMs);
    }
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const outputFolder = readStringOption(argv, 'output-folder');

  if (!outputFolder) {
    throw new Error('Scripted measurement requires --output-folder <path>.');
  }

  const repeat = readNumberOption(argv, 'repeat', 1);

  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 100) {
    throw new Error('--repeat must be an integer between 1 and 100.');
  }

  return {
    outputFolder,
    startFrequency: readNumberOption(argv, 'start-frequency', 20),
    endFrequency: readNumberOption(argv, 'end-frequency', 20000),
    durationSeconds: readNumberOption(argv, 'duration-seconds', 2),
    sweepLevelDb: readNumberOption(argv, 'sweep-level-db', -6),
    sampleRate: readNumberOption(argv, 'sample-rate', 48000),
    inputChannel: readChannelOption(argv, 'input-channel', 'both'),
    outputChannel: readChannelOption(argv, 'output-channel', 'both'),
    repeat,
    pauseMs: readNumberOption(argv, 'pause-ms', 0),
  };
}

function readStringOption(argv: string[], key: string): string | null {
  const inlinePrefix = `--${key}=`;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value) {
      continue;
    }

    if (value.startsWith(inlinePrefix)) {
      return value.slice(inlinePrefix.length);
    }

    if (value === `--${key}`) {
      return argv[index + 1] ?? null;
    }
  }

  return null;
}

function readNumberOption(argv: string[], key: string, fallback: number): number {
  const value = readStringOption(argv, key);
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${key} must be numeric.`);
  }

  return parsed;
}

function readChannelOption(
  argv: string[],
  key: string,
  fallback: 'left' | 'right' | 'both',
): 'left' | 'right' | 'both' {
  const value = readStringOption(argv, key);
  return value === 'left' || value === 'right' || value === 'both' ? value : fallback;
}

function formatTimestampForPath(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[autocal] Scripted measurement failed: ${message}`);
  process.exit(1);
});
