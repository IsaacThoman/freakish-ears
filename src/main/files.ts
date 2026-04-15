import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  ApplyEqualizerApoConfigPayload,
  ApplyEqualizerApoConfigResult,
  EqualizerApoStatus,
  PeacePresetSummary,
  ReadPeacePresetResult,
  SaveMeasurementPayload,
  SaveMeasurementResult,
} from '../shared/ipc';
import { BUNDLED_PEACE_PRESETS } from '../shared/peace-presets';

const execFileAsync = promisify(execFile);
const DEFAULT_EQUALIZER_APO_CONFIG_FOLDER = 'C:\\Program Files\\EqualizerAPO\\config';
const EQUALIZER_APO_CONFIG_FOLDER_ENV_KEY = 'FREAKISH_EARS_EQUALIZER_APO_CONFIG_FOLDER';
const APO_CONFIG_FILE_NAME = 'config.txt';
const FREAKISH_EARS_PROFILE_NAME = 'FreakishEars.txt';
const PEACE_PROFILE_NAME = 'peace.txt';
const DISABLED_FREAKISH_EARS_PROFILE_TEXT = `# FreakishEars Equalizer APO profile disabled${os.EOL}`;

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
  const configFolderPath = resolveEqualizerApoConfigFolderPath();
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

  const [configContents, peaceRunning, peaceInstalled] = await Promise.all([
    readTextIfPresent(configPath),
    isProcessRunning('peace.exe'),
    pathExists(peacePath),
  ]);

  return {
    installed: true,
    configFolderPath,
    configPath,
    profilePath,
    peaceInstalled,
    peaceRunning,
    peaceIncludedInConfig: hasActiveInclude(configContents, PEACE_PROFILE_NAME),
    freakishEarsIncludedInConfig: hasActiveInclude(configContents, FREAKISH_EARS_PROFILE_NAME),
  };
}

export async function listPeacePresets(): Promise<PeacePresetSummary[]> {
  return BUNDLED_PEACE_PRESETS.map((preset) => ({
    fileName: preset.fileName,
    displayName: preset.displayName,
    filePath: preset.fileName,
  }));
}

export async function readPeacePreset(fileName: string): Promise<ReadPeacePresetResult> {
  const normalizedFileName = path.basename(fileName);

  if (normalizedFileName !== fileName || !/\.peace$/iu.test(normalizedFileName)) {
    throw new Error('Invalid PEACE preset name.');
  }

  const preset = BUNDLED_PEACE_PRESETS.find((entry) => entry.fileName === normalizedFileName);

  if (!preset) {
    throw new Error(`PEACE preset not found: ${normalizedFileName}`);
  }

  return {
    fileName: normalizedFileName,
    contents: preset.contents,
  };
}

export async function applyEqualizerApoConfig(
  payload: ApplyEqualizerApoConfigPayload,
): Promise<ApplyEqualizerApoConfigResult> {
  const status = await getEqualizerApoStatus();

  if (!status.installed || !status.configFolderPath || !status.configPath || !status.profilePath) {
    throw new Error(getEqualizerApoUnavailableErrorMessage());
  }

  const [configContents, priorProfileContents] = await Promise.all([
    readTextIfPresent(status.configPath),
    readTextIfPresentOrNull(status.profilePath),
  ]);

  await mkdir(status.configFolderPath, { recursive: true });

  const nextProfileContents = buildManagedProfileContents(payload.configText, payload.enableProfile);
  const nextConfigContents = payload.enableProfile
    ? ensureInclude(configContents, FREAKISH_EARS_PROFILE_NAME)
    : removeInclude(configContents, FREAKISH_EARS_PROFILE_NAME);
  const profileChanged = priorProfileContents !== nextProfileContents;
  const configChanged = configContents !== nextConfigContents;

  if (!profileChanged && !configChanged) {
    return {
      configPath: status.configPath,
      profilePath: status.profilePath,
      applied: true,
      enableProfile: payload.enableProfile,
      configChanged: false,
      profileChanged: false,
      skippedReason: null,
    };
  }

  try {
    if (profileChanged) {
      await writeFile(status.profilePath, nextProfileContents, 'utf8');
    }
  } catch (error) {
    if (isBusyFileError(error)) {
      return {
        configPath: status.configPath,
        profilePath: status.profilePath,
        applied: false,
        enableProfile: payload.enableProfile,
        configChanged,
        profileChanged,
        skippedReason: 'locked',
      };
    }

    throw error;
  }

  try {
    if (configChanged) {
      await writeFile(status.configPath, nextConfigContents, 'utf8');
    }
  } catch (error) {
    if (profileChanged) {
      await restorePreviousProfileContents(status.profilePath, priorProfileContents);
    }

    if (isBusyFileError(error)) {
      return {
        configPath: status.configPath,
        profilePath: status.profilePath,
        applied: false,
        enableProfile: payload.enableProfile,
        configChanged,
        profileChanged,
        skippedReason: 'locked',
      };
    }

    throw error;
  }

  return {
    configPath: status.configPath,
    profilePath: status.profilePath,
    applied: true,
    enableProfile: payload.enableProfile,
    configChanged,
    profileChanged,
    skippedReason: null,
  };
}

export async function disablePeace(): Promise<{ disabled: boolean; processKilled: boolean }> {
  const status = await getEqualizerApoStatus();

  if (!status.installed || !status.configPath) {
    throw new Error(getEqualizerApoUnavailableErrorMessage());
  }

  const configContents = await readTextIfPresent(status.configPath);
  const peaceWasIncluded = hasActiveInclude(configContents, PEACE_PROFILE_NAME);

  let processKilled = false;
  if (status.peaceRunning) {
    try {
      await execFileAsync('taskkill', ['/IM', 'Peace.exe', '/F']);
      processKilled = true;
    } catch {
      // Process might have already exited.
    }
  }

  if (peaceWasIncluded) {
    const nextConfigContents = removeInclude(configContents, PEACE_PROFILE_NAME);
    await writeFile(status.configPath, nextConfigContents, 'utf8');
    return { disabled: true, processKilled };
  }

  return { disabled: false, processKilled };
}

function resolveEqualizerApoConfigFolderPath(): string {
  const overridePath = process.env[EQUALIZER_APO_CONFIG_FOLDER_ENV_KEY]?.trim();
  return overridePath ? path.resolve(overridePath) : DEFAULT_EQUALIZER_APO_CONFIG_FOLDER;
}

function getEqualizerApoUnavailableErrorMessage(): string {
  return `Equalizer APO is not installed in the configured config location (${resolveEqualizerApoConfigFolderPath()}).`;
}

function buildManagedProfileContents(configText: string, enableProfile: boolean): string {
  if (!enableProfile) {
    return DISABLED_FREAKISH_EARS_PROFILE_TEXT;
  }

  const normalizedContents = configText
    .replace(/\r\n/gu, '\n')
    .replace(/\r/gu, '\n')
    .trim();

  return normalizedContents.length > 0
    ? `${normalizedContents.split('\n').join(os.EOL)}${os.EOL}`
    : DISABLED_FREAKISH_EARS_PROFILE_TEXT;
}

function splitConfigLines(contents: string): string[] {
  return contents
    .split(/\r?\n/u)
    .filter((line, index, allLines) => !(index === allLines.length - 1 && line === ''));
}

function joinConfigLines(lines: string[]): string {
  return lines.length > 0 ? `${lines.join(os.EOL)}${os.EOL}` : '';
}

function ensureInclude(contents: string, fileName: string): string {
  const nextLines = removeMatchingIncludeLines(splitConfigLines(contents), fileName);
  nextLines.push(`Include: ${fileName}`);
  return joinConfigLines(nextLines);
}

function removeInclude(contents: string, fileName: string): string {
  return joinConfigLines(removeMatchingIncludeLines(splitConfigLines(contents), fileName));
}

function removeMatchingIncludeLines(lines: string[], fileName: string): string[] {
  return lines.filter((line) => !matchesIncludeTarget(line, fileName));
}

function matchesIncludeTarget(line: string, fileName: string): boolean {
  const includeTarget = parseIncludeTarget(line);
  if (!includeTarget) {
    return false;
  }

  const normalizedTarget = includeTarget.replace(/\//gu, '\\');
  return path.win32.basename(normalizedTarget).toLowerCase() === fileName.toLowerCase();
}

function parseIncludeTarget(line: string): string | null {
  const trimmedLine = line.trim();
  if (trimmedLine.length === 0 || trimmedLine.startsWith('#') || trimmedLine.startsWith(';')) {
    return null;
  }

  const match = trimmedLine.match(/^Include:\s*(.+?)\s*$/iu);
  if (!match) {
    return null;
  }

  return stripWrappingQuotes(match[1].trim());
}

function stripWrappingQuotes(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1).trim();
  }

  return value;
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

async function readTextIfPresentOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function restorePreviousProfileContents(
  filePath: string,
  priorContents: string | null,
): Promise<void> {
  if (priorContents === null) {
    await rm(filePath, { force: true });
    return;
  }

  await writeFile(filePath, priorContents, 'utf8');
}

function hasActiveInclude(contents: string, fileName: string): boolean {
  return splitConfigLines(contents).some((line) => matchesIncludeTarget(line, fileName));
}

function isBusyFileError(error: unknown): boolean {
  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const message = error instanceof Error ? error.message : String(error);

  return errorCode === 'EBUSY' ||
    errorCode === 'EPERM' ||
    errorCode === 'EACCES' ||
    /\bEBUSY\b/u.test(message) ||
    /resource busy or locked/iu.test(message) ||
    /used by another process/iu.test(message);
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
