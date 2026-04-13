import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  ApplyEqualizerApoConfigPayload,
  ApplyEqualizerApoConfigResult,
  EqualizerApoStatus,
  SaveMeasurementPayload,
  SaveMeasurementResult,
} from '../shared/ipc';

const execFileAsync = promisify(execFile);
const DEFAULT_EQUALIZER_APO_CONFIG_FOLDER = 'C:\\Program Files\\EqualizerAPO\\config';
const APO_CONFIG_FILE_NAME = 'config.txt';
const FREAKISH_EARS_PROFILE_NAME = 'FreakishEars.txt';
const PEACE_PROFILE_NAME = 'peace.txt';

export function sanitizePathSegment(value: string): string {
  const sanitized = Array.from(value.trim(), (character) => {
    const codePoint = character.charCodeAt(0);

    if (
      codePoint < 32 ||
      '<>:"/\\|?*'.includes(character) ||
      /\s/.test(character)
    ) {
      return '-';
    }

    return character;
  })
    .join('')
    .replace(/-+/g, '-')
    .slice(0, 120);

  return sanitized || 'measurement';
}

export async function saveMeasurementSession(
  payload: SaveMeasurementPayload,
): Promise<SaveMeasurementResult> {
  const sessionDirectory = path.join(
    payload.folderPath,
    sanitizePathSegment(payload.sessionName),
  );

  await mkdir(sessionDirectory, { recursive: true });

  const filePaths: string[] = [];

  for (const file of payload.files) {
    const filePath = path.join(
      sessionDirectory,
      sanitizePathSegment(file.name),
    );

    await writeFile(filePath, Buffer.from(file.contents));
    filePaths.push(filePath);
  }

  return {
    sessionDirectory,
    filePaths,
  };
}

export async function deleteMeasurementSession(sessionDirectory: string): Promise<void> {
  await rm(sessionDirectory, { recursive: true, force: true });
}

export async function saveFileAtPath(filePath: string, contents: Uint8Array): Promise<string> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Buffer.from(contents));
  return filePath;
}

export async function getEqualizerApoStatus(): Promise<EqualizerApoStatus> {
  const configFolderPath = DEFAULT_EQUALIZER_APO_CONFIG_FOLDER;
  const configPath = path.join(configFolderPath, APO_CONFIG_FILE_NAME);
  const profilePath = path.join(configFolderPath, FREAKISH_EARS_PROFILE_NAME);
  const peacePath = path.join(configFolderPath, PEACE_PROFILE_NAME);
  const installed = await pathExists(configFolderPath);

  if (!installed) {
    return {
      installed: false,
      configFolderPath: null,
      configPath: null,
      profilePath: null,
      peaceInstalled: false,
      peaceRunning: false,
      peaceIncludedInConfig: false,
      freakishEarsIncludedInConfig: false,
    };
  }

  const [configContents, peaceRunning] = await Promise.all([
    readTextIfPresent(configPath),
    isProcessRunning('peace.exe'),
  ]);

  return {
    installed: true,
    configFolderPath,
    configPath,
    profilePath,
    peaceInstalled: await pathExists(peacePath),
    peaceRunning,
    peaceIncludedInConfig: hasActiveInclude(configContents, PEACE_PROFILE_NAME),
    freakishEarsIncludedInConfig: hasActiveInclude(configContents, FREAKISH_EARS_PROFILE_NAME),
  };
}

export async function applyEqualizerApoConfig(
  payload: ApplyEqualizerApoConfigPayload,
): Promise<ApplyEqualizerApoConfigResult> {
  const status = await getEqualizerApoStatus();

  if (!status.installed || !status.configFolderPath || !status.configPath || !status.profilePath) {
    throw new Error('Equalizer APO is not installed in the default config location.');
  }

  const configContents = await readTextIfPresent(status.configPath);

  await mkdir(status.configFolderPath, { recursive: true });
  await writeFile(status.profilePath, payload.configText, 'utf8');

  const nextConfigContents = ensureFreakishEarsInclude(configContents);
  await writeFile(status.configPath, nextConfigContents, 'utf8');

  return {
    configPath: status.configPath,
    profilePath: status.profilePath,
  };
}

export async function disablePeace(): Promise<{ disabled: boolean; processKilled: boolean }> {
  const status = await getEqualizerApoStatus();

  if (!status.installed || !status.configPath) {
    throw new Error('Equalizer APO is not installed in the default config location.');
  }

  const configContents = await readTextIfPresent(status.configPath);
  const peaceWasIncluded = hasActiveInclude(configContents, PEACE_PROFILE_NAME);

  let processKilled = false;
  if (status.peaceRunning) {
    try {
      await execFileAsync('taskkill', ['/IM', 'Peace.exe', '/F']);
      processKilled = true;
    } catch {
      // Process might have already exited
    }
  }

  if (peaceWasIncluded) {
    const nextConfigContents = removePeaceInclude(configContents);
    await writeFile(status.configPath, nextConfigContents, 'utf8');
    return { disabled: true, processKilled };
  }

  return { disabled: false, processKilled };
}

function removePeaceInclude(contents: string): string {
  const nextLines = contents
    .split(/\r?\n/u)
    .filter((line) => !/^Include:\s*peace\.txt$/iu.test(line.trim()))
    .filter((line, index, allLines) => !(index === allLines.length - 1 && line === ''));

  return nextLines.length > 0 ? `${nextLines.join(os.EOL)}${os.EOL}` : '';
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfPresent(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function hasActiveInclude(contents: string, fileName: string): boolean {
  return contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .some((line) => new RegExp(`^Include:\\s*${escapeRegExp(fileName)}$`, 'iu').test(line));
}

function ensureFreakishEarsInclude(contents: string): string {
  const lines = contents
    .split(/\r?\n/u)
    .filter((line, index, allLines) => !(index === allLines.length - 1 && line === ''));

  if (lines.some((line) => /^Include:\s*FreakishEars\.txt$/iu.test(line.trim()))) {
    return `${lines.join(os.EOL)}${os.EOL}`;
  }

  const nextLines = [...lines];
  nextLines.push('Include: FreakishEars.txt');
  return `${nextLines.join(os.EOL)}${os.EOL}`;
}

async function isProcessRunning(imageName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('tasklist', ['/FI', `IMAGENAME eq ${imageName}`]);
    const escapedImageName = escapeRegExp(imageName);
    return new RegExp(`^${escapedImageName}\\s+`, 'imu').test(stdout);
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
