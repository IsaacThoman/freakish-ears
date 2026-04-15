import { app, BrowserWindow, Rectangle } from 'electron';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { saveFileAtPath, saveMeasurementSession } from './files';
import { runSoxMeasurement } from './sox';
import { createWindow } from './window';
import { PRE_ROLL_SECONDS, POST_ROLL_SECONDS } from '../renderer/constants';
import { encodeWavFile } from '../shared/audio';
import type {
  AutomationVirtualFile,
  HeadlessAutomationScript,
  HeadlessAutomationStep,
  RendererAutomationAction,
  RendererAutomationElementBounds,
  RendererAutomationSnapshot,
} from '../shared/automation';
import {
  buildMeasurementCsv,
  buildMeasurementJson,
} from '../renderer/measurements';
import { analyzeMeasurement } from '../shared/measurement-analysis';

type HeadlessMeasurementOptions = {
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

type LoadedHeadlessAutomationScript = {
  script: HeadlessAutomationScript;
  scriptPath: string;
  logPath: string;
};

export function isHeadlessMeasurementMode(argv: string[]): boolean {
  return argv.includes('--headless-measure');
}

export function isHeadlessAutomationMode(argv: string[]): boolean {
  return argv.includes('--headless-automation');
}

export async function runHeadlessMeasurementMode(argv: string[]): Promise<void> {
  const options = parseHeadlessMeasurementOptions(argv);

  for (let runIndex = 0; runIndex < options.repeat; runIndex += 1) {
    const measurementNumber = runIndex + 1;
    console.log(
      `[autocal] Starting headless SoX measurement ${measurementNumber}/${options.repeat}`,
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

  app.quit();
}

export async function runHeadlessAutomationMode(argv: string[]): Promise<void> {
  const { script, scriptPath, logPath } = await loadHeadlessAutomationScript(argv);
  await writeFile(logPath, '');
  await logHeadlessAutomation(logPath, `Starting headless automation with script ${scriptPath}`);
  const mainWindow = createWindow({
    width: normalizeWindowDimension(script.window?.width, 1440),
    height: normalizeWindowDimension(script.window?.height, 1024),
    show: false,
  });

  try {
    await waitForAutomationBridge(mainWindow);
    await logHeadlessAutomation(logPath, 'Renderer automation bridge is ready');

    for (const [stepIndex, step] of script.steps.entries()) {
      await logHeadlessAutomation(
        logPath,
        `Running automation step ${stepIndex + 1}/${script.steps.length}: ${step.type}`,
      );
      await runAutomationStep(mainWindow, step);
    }
    await logHeadlessAutomation(logPath, 'Headless automation completed successfully');
  } catch (error) {
    await logHeadlessAutomation(logPath, `Headless automation failed: ${getErrorMessage(error)}`);
    throw error;
  } finally {
    mainWindow.destroy();
    app.exit(0);
  }
}

function parseHeadlessMeasurementOptions(argv: string[]): HeadlessMeasurementOptions {
  const outputFolder = readStringOption(argv, 'output-folder');

  if (!outputFolder) {
    throw new Error('Headless measurement requires --output-folder <path>.');
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

async function loadHeadlessAutomationScript(argv: string[]): Promise<LoadedHeadlessAutomationScript> {
  const scriptPath = readStringOption(argv, 'script');

  if (!scriptPath) {
    throw new Error('Headless automation requires --script <path>.');
  }

  const absoluteScriptPath = path.resolve(scriptPath);
  const contents = await readFile(absoluteScriptPath, 'utf8');
  const parsed = JSON.parse(contents) as HeadlessAutomationScript;

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.steps)) {
    throw new Error('Automation script must be a JSON object with a steps array.');
  }

  return {
    script: parsed,
    scriptPath: absoluteScriptPath,
    logPath: path.join(path.dirname(absoluteScriptPath), 'headless-automation.log'),
  };
}

async function logHeadlessAutomation(logPath: string, message: string): Promise<void> {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  await appendFile(logPath, line, 'utf8');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function waitForAutomationBridge(mainWindow: BrowserWindow): Promise<void> {
  const timeoutAt = Date.now() + 30000;

  while (Date.now() < timeoutAt) {
    const ready = await mainWindow.webContents.executeJavaScript(
      'Boolean(window.freakishEarsAutomation)',
      true,
    );

    if (ready) {
      return;
    }

    await wait(100);
  }

  throw new Error('Renderer automation bridge did not become ready in time.');
}

async function runAutomationStep(
  mainWindow: BrowserWindow,
  step: HeadlessAutomationStep,
): Promise<void> {
  if (step.type === 'screenshot') {
    await saveScreenshot(mainWindow, step.outputPath, step.selector);
    return;
  }

  await runRendererAutomationAction(mainWindow, step.action);
}

async function runRendererAutomationAction(
  mainWindow: BrowserWindow,
  action: RendererAutomationAction,
): Promise<RendererAutomationSnapshot> {
  const normalizedAction = await resolveRendererAutomationActionFiles(action);
  return mainWindow.webContents.executeJavaScript(
    `window.freakishEarsAutomation.runAction(${JSON.stringify(normalizedAction)})`,
    true,
  ) as Promise<RendererAutomationSnapshot>;
}

async function resolveRendererAutomationActionFiles(
  action: RendererAutomationAction,
): Promise<RendererAutomationAction> {
  switch (action.type) {
    case 'import-measurements':
      return {
        ...action,
        files: await Promise.all(action.files.map(resolveAutomationFile)),
      };
    case 'import-references':
      return {
        ...action,
        files: await Promise.all(action.files.map(resolveAutomationFile)),
      };
    case 'import-microphone-calibration':
      return {
        ...action,
        file: await resolveAutomationFile(action.file),
      };
    case 'import-eq-profile':
      return {
        ...action,
        file: await resolveAutomationFile(action.file),
      };
    default:
      return action;
  }
}

async function resolveAutomationFile(file: AutomationVirtualFile): Promise<AutomationVirtualFile> {
  if (typeof file.contents === 'string') {
    return file;
  }

  if (!file.path) {
    throw new Error(`Automation file ${file.name} is missing contents and path.`);
  }

  return {
    ...file,
    contents: await readFile(path.resolve(file.path), 'utf8'),
  };
}

async function saveScreenshot(
  mainWindow: BrowserWindow,
  outputPath: string,
  selector?: string,
): Promise<void> {
  const absoluteOutputPath = path.resolve(outputPath);
  const captureBounds = selector
    ? await getAutomationElementCaptureBounds(mainWindow, selector)
    : null;
  const image = captureBounds
    ? await mainWindow.webContents.capturePage(captureBounds)
    : await mainWindow.webContents.capturePage();

  await saveFileAtPath(absoluteOutputPath, image.toPNG());
  console.log(JSON.stringify({ screenshotPath: absoluteOutputPath, selector: selector ?? null }));
}

async function getAutomationElementCaptureBounds(
  mainWindow: BrowserWindow,
  selector: string,
): Promise<Rectangle> {
  const bounds = await mainWindow.webContents.executeJavaScript(
    `window.freakishEarsAutomation.getElementBounds(${JSON.stringify(selector)})`,
    true,
  ) as RendererAutomationElementBounds;

  if (!bounds) {
    throw new Error(`Unable to find screenshot selector: ${selector}`);
  }

  return {
    x: Math.max(0, Math.floor(bounds.x * bounds.devicePixelRatio)),
    y: Math.max(0, Math.floor(bounds.y * bounds.devicePixelRatio)),
    width: Math.max(1, Math.ceil(bounds.width * bounds.devicePixelRatio)),
    height: Math.max(1, Math.ceil(bounds.height * bounds.devicePixelRatio)),
  };
}

function normalizeWindowDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(960, Math.round(value as number));
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
