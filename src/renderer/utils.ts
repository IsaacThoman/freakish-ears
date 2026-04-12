import type { MeasurementPoint } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatTimestampForPath(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function readStoredNumber(storageKey: string, fallback: number): number {
  const storedValue = localStorage.getItem(storageKey);
  const parsed = Number(storedValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

export function getPathBaseName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/gu, '/');
  const baseName = normalizedPath.split('/').at(-1) ?? filePath;
  return baseName || 'measurement';
}

export function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/u, '');
}

export function sanitizeMeasurementName(value: string): string {
  const trimmed = value.trim().replace(/\s+/gu, '-');
  return trimmed || 'measurement';
}

export function toOptionalNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function formatFrequencyLabel(frequencyHz: number): string {
  if (frequencyHz >= 1000) {
    return `${(frequencyHz / 1000).toFixed(frequencyHz >= 10000 ? 0 : 1)}k`;
  }

  return frequencyHz.toFixed(0);
}

export function formatFrequencyDetailed(frequencyHz: number): string {
  if (frequencyHz >= 1000) {
    return `${(frequencyHz / 1000).toFixed(2)} kHz`;
  }

  return `${frequencyHz.toFixed(1)} Hz`;
}

export function formatDbLabel(valueDb: number): string {
  return `${valueDb.toFixed(0)} dB`;
}

export function findClosestPoint(
  points: MeasurementPoint[],
  frequencyHz: number,
): MeasurementPoint {
  let low = 0;
  let high = points.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (points[middle].frequencyHz < frequencyHz) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const current = points[low] ?? points[0];
  const previous = points[Math.max(0, low - 1)] ?? current;

  return Math.abs(previous.frequencyHz - frequencyHz) <
    Math.abs(current.frequencyHz - frequencyHz)
    ? previous
    : current;
}
