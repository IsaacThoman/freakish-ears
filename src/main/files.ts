import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { SaveMeasurementPayload, SaveMeasurementResult } from '../shared/ipc';

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
