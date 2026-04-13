import {
  DEFAULT_END_FREQUENCY,
  DEFAULT_START_FREQUENCY,
  PLOT_COLORS,
  PLOT_NORMALIZATION_FREQUENCY_HZ,
} from './constants';
import type {
  LoadedMeasurement,
  MeasurementAnalysis,
  MeasurementBackend,
  MeasurementChannelSelection,
  MeasurementImport,
  MeasurementMagnitudeMode,
  MeasurementPoint,
  MeasurementSmoothingMode,
  MeasurementSummary,
  ReferenceCurve,
} from './types';

const REFERENCE_CURVE_COLOR = '#7d7d7d';
import {
  clamp,
  findClosestPoint,
  getPathBaseName,
  sanitizeMeasurementName,
  stripFileExtension,
  toOptionalNumber,
} from './utils';

export function buildMeasurementJson(input: {
  analysis: MeasurementAnalysis;
  capture: { recording: Float32Array };
  microphoneLabel: string;
  outputDeviceLabel: string;
    settings: {
      backend: MeasurementBackend;
      startFrequency: number;
      endFrequency: number;
      durationSeconds: number;
      sweepLevelDb: number;
      sampleRate: number;
      inputChannel: MeasurementChannelSelection;
      outputChannel: MeasurementChannelSelection;
    };
  preRollSeconds: number;
  postRollSeconds: number;
  splOffsetDb: number;
}): string {
  return JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      microphoneLabel: input.microphoneLabel,
      outputDeviceLabel: input.outputDeviceLabel,
      settings: {
        ...input.settings,
        preRollSeconds: input.preRollSeconds,
        postRollSeconds: input.postRollSeconds,
        captureFormat: 'mono pcm 16-bit wav export',
        magnitudeUnits: 'relative dB',
        splCalibrationOffsetDb: input.splOffsetDb,
      },
      sampleRate: input.analysis.sampleRate,
      sweepStartSample: input.analysis.sweepStartSample,
      latencyMs: input.analysis.latencyMs,
      recordingLengthSeconds: input.analysis.recordingLengthSeconds,
      peakDbfs: input.analysis.peakDbfs,
      rmsDbfs: input.analysis.rmsDbfs,
      sampleCount: input.capture.recording.length,
      responsePoints: input.analysis.points,
    },
    null,
    2,
  );
}

export function buildMeasurementCsv(points: MeasurementPoint[]): string {
  const header =
    'frequency_hz,magnitude_db_relative,smoothed_magnitude_db_relative,phase_degrees,smoothed_phase_degrees';
  const rows = points.map(
    (point) =>
      `${point.frequencyHz.toFixed(3)},${point.magnitudeDbRelative.toFixed(4)},${point.smoothedMagnitudeDbRelative.toFixed(4)},${point.phaseDegrees.toFixed(4)},${point.smoothedPhaseDegrees.toFixed(4)}`,
  );

  return [header, ...rows].join('\n');
}

export function buildRewMeasurementText(input: {
  measurement: LoadedMeasurement;
  splOffsetDb: number;
}): string {
  const exportPoints = getMeasurementPointsForDisplay(
    input.measurement.points,
    input.measurement,
    false,
    input.splOffsetDb,
    '1/12',
    null,
  );
  const exportUnitLabel =
    input.measurement.magnitudeMode === 'relative' && input.splOffsetDb !== 0
      ? `* Note: Magnitude values include the current SPL offset of ${input.splOffsetDb.toFixed(1)} dB.`
      : input.measurement.magnitudeMode === 'relative'
        ? '* Note: Magnitude values are exported in relative dB using the plotted response trace.'
        : '* Note: Magnitude values are exported from the imported SPL trace.';
  const lines = [
    '* Measurement data exported by Freakish Ears',
    `* Source: ${input.measurement.sourcePath ?? 'Freakish Ears'}`,
    `* Dated: ${new Date().toLocaleString()}`,
    `* Measurement: ${input.measurement.name}`,
    exportUnitLabel,
    '*',
    '* Freq(Hz) SPL(dB) Phase(degrees)',
    ...exportPoints.map(
      (point) =>
        `${point.frequencyHz.toFixed(6)} ${point.smoothedMagnitudeDbRelative.toFixed(4)} ${point.smoothedPhaseDegrees.toFixed(4)}`,
    ),
  ];

  return lines.join('\n');
}

export function parseImportedMeasurementFile(
  file: File,
  contents: string,
): MeasurementImport {
  const filePath = getImportedFilePath(file);
  const baseName = stripFileExtension(file.name);
  const trimmed = contents.trim();
  let parsedPoints: MeasurementPoint[];
  let magnitudeMode: MeasurementMagnitudeMode = 'spl';
  let displayName = baseName;
  let summary: MeasurementSummary = {
    latencyMs: null,
    peakDbfs: null,
    rmsDbfs: null,
    savedPath: filePath,
  };

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as
      | {
          microphoneLabel?: unknown;
          latencyMs?: unknown;
          peakDbfs?: unknown;
          responsePoints?: unknown;
          rmsDbfs?: unknown;
          settings?: unknown;
        }
      | MeasurementPoint[];

    const rawPoints = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.responsePoints)
        ? parsed.responsePoints
        : null;

    if (!rawPoints) {
      throw new Error('JSON file does not contain response points.');
    }

    parsedPoints = normalizeMeasurementPoints(rawPoints);
    magnitudeMode = inferJsonMeasurementMagnitudeMode(parsed);

    if (!Array.isArray(parsed) && typeof parsed.microphoneLabel === 'string') {
      displayName = parsed.microphoneLabel;
    }

    if (!Array.isArray(parsed)) {
      summary = {
        latencyMs: toOptionalNumber(parsed.latencyMs),
        peakDbfs: toOptionalNumber(parsed.peakDbfs),
        rmsDbfs: toOptionalNumber(parsed.rmsDbfs),
        savedPath: filePath,
      };
    }
  } else if (looksLikeCsvMeasurement(contents)) {
    parsedPoints = parseCsvMeasurementPoints(contents);
    magnitudeMode = 'relative';
  } else if (looksLikeTargetCurveMeasurement(contents)) {
    parsedPoints = parseTargetCurveMeasurementPoints(contents);
    magnitudeMode = 'spl';
  } else {
    parsedPoints = parseRewMeasurementPoints(contents);
    magnitudeMode = inferTextMeasurementMagnitudeMode(contents);
  }

  return {
    name: displayName,
    exportName: baseName,
    magnitudeMode,
    sourcePath: filePath,
    points: parsedPoints,
    summary,
  };
}

export function createLoadedMeasurement(
  input: MeasurementImport,
  measurementIndex: number,
): LoadedMeasurement {
  return {
    id: `measurement-${measurementIndex}`,
    name: input.name,
    exportName: sanitizeMeasurementName(input.exportName),
    color: PLOT_COLORS[(measurementIndex - 1) % PLOT_COLORS.length],
    starred: false,
    visible: true,
    magnitudeMode: input.magnitudeMode,
    sourcePath: input.sourcePath,
    summary: input.summary,
    points: input.points,
    plotPoints: buildPlotPoints(input.points),
  };
}

export function createMeasurementFromAnalysis(
  analysis: MeasurementAnalysis,
  sessionDirectory: string,
  measurementIndex: number,
): LoadedMeasurement {
  const baseName = getPathBaseName(sessionDirectory);

  return createLoadedMeasurement(
    {
      name: baseName,
      exportName: baseName,
      magnitudeMode: 'relative',
      sourcePath: sessionDirectory,
      points: analysis.points,
      summary: {
        latencyMs: analysis.latencyMs,
        peakDbfs: analysis.peakDbfs,
        rmsDbfs: analysis.rmsDbfs,
        savedPath: sessionDirectory,
      },
    },
    measurementIndex,
  );
}

export function createReferenceCurve(
  input: MeasurementImport,
  referenceIndex: number,
): ReferenceCurve {
  return {
    id: `reference-${referenceIndex}`,
    name: input.name,
    exportName: sanitizeMeasurementName(input.exportName),
    color: REFERENCE_CURVE_COLOR,
    starred: false,
    visible: true,
    magnitudeMode: 'spl',
    sourcePath: input.sourcePath,
    summary: input.summary,
    points: input.points,
    plotPoints: buildPlotPoints(input.points),
  };
}

export function getMeasurementPointsForDisplay(
  points: MeasurementPoint[],
  measurement: LoadedMeasurement,
  normalizePlot: boolean,
  splOffsetDb: number,
  smoothingMode: MeasurementSmoothingMode,
  referenceNormalizationDb: number | null,
): MeasurementPoint[] {
  const totalOffsetDb = normalizePlot
    ? (referenceNormalizationDb ?? 0) -
      findClosestPoint(points, PLOT_NORMALIZATION_FREQUENCY_HZ)
        .smoothedMagnitudeDbRelative
    : getMeasurementCalibrationOffsetDb(measurement, splOffsetDb);

  const offsetPoints = totalOffsetDb === 0
    ? points
    : points.map((point) => ({
    ...point,
    magnitudeDbRelative: point.magnitudeDbRelative + totalOffsetDb,
    smoothedMagnitudeDbRelative: point.smoothedMagnitudeDbRelative + totalOffsetDb,
  }));

  return applyMeasurementSmoothing(offsetPoints, smoothingMode);
}

function applyMeasurementSmoothing(
  points: MeasurementPoint[],
  smoothingMode: MeasurementSmoothingMode,
): MeasurementPoint[] {
  if (smoothingMode === 'raw') {
    return points.map((point) => ({
      ...point,
      smoothedMagnitudeDbRelative: point.magnitudeDbRelative,
      smoothedPhaseDegrees: point.phaseDegrees,
    }));
  }

  const octaveDivisor = parseSmoothingDivisor(smoothingMode);
  const widthRatio = Math.pow(2, 1 / (2 * octaveDivisor));

  return points.map((point) => {
    const lowFrequency = point.frequencyHz / widthRatio;
    const highFrequency = point.frequencyHz * widthRatio;
    const window = points.filter(
      (candidate) =>
        candidate.frequencyHz >= lowFrequency && candidate.frequencyHz <= highFrequency,
    );
    const smoothedWindow = window.length > 0 ? window : [point];
    const meanPower =
      smoothedWindow.reduce(
        (total, candidate) =>
          total + Math.pow(10, candidate.magnitudeDbRelative / 10),
        0,
      ) / smoothedWindow.length;
    const complex = smoothedWindow.reduce(
      (total, candidate) => {
        const magnitude = Math.pow(10, candidate.magnitudeDbRelative / 20);
        const phaseRadians = (candidate.phaseDegrees * Math.PI) / 180;
        return {
          real: total.real + magnitude * Math.cos(phaseRadians),
          imag: total.imag + magnitude * Math.sin(phaseRadians),
        };
      },
      { real: 0, imag: 0 },
    );

    return {
      ...point,
      smoothedMagnitudeDbRelative: 10 * Math.log10(meanPower + 1e-18),
      smoothedPhaseDegrees: (Math.atan2(complex.imag, complex.real) * 180) / Math.PI,
    };
  });
}

function parseSmoothingDivisor(smoothingMode: MeasurementSmoothingMode): number {
  if (smoothingMode === 'raw') {
    return 1;
  }

  const divisor = Number(smoothingMode.split('/')[1]);
  return Number.isFinite(divisor) && divisor > 0 ? divisor : 12;
}

function getMeasurementCalibrationOffsetDb(
  measurement: LoadedMeasurement,
  splOffsetDb: number,
): number {
  return measurement.magnitudeMode === 'relative' ? splOffsetDb : 0;
}

function getImportedFilePath(file: File): string | null {
  const fileWithPath = file as File & { path?: string };
  return fileWithPath.path ?? null;
}

function inferJsonMeasurementMagnitudeMode(
  parsed: {
    settings?: unknown;
  } | MeasurementPoint[],
): MeasurementMagnitudeMode {
  if (Array.isArray(parsed) || !parsed.settings || typeof parsed.settings !== 'object') {
    return 'relative';
  }

  const units = String(
    (parsed.settings as Record<string, unknown>).magnitudeUnits ?? 'relative dB',
  ).toLowerCase();

  return units.includes('relative') ? 'relative' : 'spl';
}

function inferTextMeasurementMagnitudeMode(contents: string): MeasurementMagnitudeMode {
  const lowerContents = contents.toLowerCase();
  if (lowerContents.includes('breakpoints') && lowerContents.includes('lowlimithz')) {
    return 'spl';
  }

  if (
    lowerContents.includes('measurement data exported by freakish ears') ||
    lowerContents.includes('relative db using the plotted response trace') ||
    lowerContents.includes('relative dB using the plotted response trace'.toLowerCase()) ||
    lowerContents.includes('include the current spl offset')
  ) {
    return 'relative';
  }

  return 'spl';
}

function looksLikeCsvMeasurement(contents: string): boolean {
  const firstLine = contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine?.includes(',') ?? false;
}

function looksLikeTargetCurveMeasurement(contents: string): boolean {
  const upperContents = contents.toUpperCase();
  return upperContents.includes('BREAKPOINTS') && upperContents.includes('LOWLIMITHZ');
}

function parseCsvMeasurementPoints(contents: string): MeasurementPoint[] {
  const points: MeasurementPoint[] = [];

  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.toLowerCase().startsWith('frequency_hz')) {
      continue;
    }

    const [
      frequencyToken,
      magnitudeToken,
      smoothedToken,
      phaseToken,
      smoothedPhaseToken,
    ] = trimmed.split(',');
    const frequencyHz = Number(frequencyToken);
    const magnitudeDbRelative = Number(magnitudeToken);
    const smoothedMagnitudeDbRelative = Number(smoothedToken);
    const phaseDegrees = Number(phaseToken);
    const smoothedPhaseDegrees = Number(smoothedPhaseToken);

    if (!Number.isFinite(frequencyHz) || !Number.isFinite(magnitudeDbRelative)) {
      continue;
    }

    points.push({
      frequencyHz,
      magnitudeDbRelative,
      phaseDegrees: Number.isFinite(phaseDegrees) ? phaseDegrees : 0,
      smoothedMagnitudeDbRelative: Number.isFinite(smoothedMagnitudeDbRelative)
        ? smoothedMagnitudeDbRelative
        : magnitudeDbRelative,
      smoothedPhaseDegrees: Number.isFinite(smoothedPhaseDegrees)
        ? smoothedPhaseDegrees
        : Number.isFinite(phaseDegrees)
          ? phaseDegrees
          : 0,
    });
  }

  return ensureMeasurementPoints(points);
}

function parseRewMeasurementPoints(contents: string): MeasurementPoint[] {
  const points: MeasurementPoint[] = [];

  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('*')) {
      continue;
    }

    const [frequencyToken, magnitudeToken, phaseToken] = trimmed.split(/\s+/u);
    const frequencyHz = Number(frequencyToken);
    const magnitudeDb = Number(magnitudeToken);
    const phaseDegrees = Number(phaseToken);

    if (!Number.isFinite(frequencyHz) || !Number.isFinite(magnitudeDb)) {
      continue;
    }

    points.push({
      frequencyHz,
      magnitudeDbRelative: magnitudeDb,
      phaseDegrees: Number.isFinite(phaseDegrees) ? phaseDegrees : 0,
      smoothedMagnitudeDbRelative: magnitudeDb,
      smoothedPhaseDegrees: Number.isFinite(phaseDegrees) ? phaseDegrees : 0,
    });
  }

  return ensureMeasurementPoints(points);
}

function parseTargetCurveMeasurementPoints(contents: string): MeasurementPoint[] {
  const points: MeasurementPoint[] = [];
  const lines = contents.split(/\r?\n/u).map((line) => line.trim());
  const breakpointsIndex = lines.findIndex((line) => line.toUpperCase() === 'BREAKPOINTS');

  if (breakpointsIndex < 0) {
    throw new Error('Target curve file does not contain BREAKPOINTS.');
  }

  for (let index = breakpointsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    if (/^[A-Z]+/u.test(line)) {
      break;
    }

    const [frequencyToken, magnitudeToken] = line.split(/\s+/u);
    const frequencyHz = Number(frequencyToken);
    const magnitudeDb = Number(magnitudeToken);

    if (!Number.isFinite(frequencyHz) || !Number.isFinite(magnitudeDb)) {
      continue;
    }

    points.push({
      frequencyHz,
      magnitudeDbRelative: magnitudeDb,
      phaseDegrees: 0,
      smoothedMagnitudeDbRelative: magnitudeDb,
      smoothedPhaseDegrees: 0,
    });
  }

  return ensureMeasurementPoints(points);
}

function normalizeMeasurementPoints(rawPoints: unknown[]): MeasurementPoint[] {
  const points: MeasurementPoint[] = [];

  for (const rawPoint of rawPoints) {
    if (!rawPoint || typeof rawPoint !== 'object') {
      continue;
    }

    const record = rawPoint as Record<string, unknown>;
    const frequencyHz = Number(record.frequencyHz);
    const magnitudeDbRelative = Number(record.magnitudeDbRelative);
    const phaseDegrees = Number(record.phaseDegrees);
    const smoothedMagnitudeDbRelative = Number(
      record.smoothedMagnitudeDbRelative ?? record.magnitudeDbRelative,
    );
    const smoothedPhaseDegrees = Number(
      record.smoothedPhaseDegrees ?? record.phaseDegrees,
    );

    if (!Number.isFinite(frequencyHz) || !Number.isFinite(magnitudeDbRelative)) {
      continue;
    }

    points.push({
      frequencyHz,
      magnitudeDbRelative,
      phaseDegrees: Number.isFinite(phaseDegrees) ? phaseDegrees : 0,
      smoothedMagnitudeDbRelative: Number.isFinite(smoothedMagnitudeDbRelative)
        ? smoothedMagnitudeDbRelative
        : magnitudeDbRelative,
      smoothedPhaseDegrees: Number.isFinite(smoothedPhaseDegrees)
        ? smoothedPhaseDegrees
        : Number.isFinite(phaseDegrees)
          ? phaseDegrees
          : 0,
    });
  }

  return ensureMeasurementPoints(points);
}

function ensureMeasurementPoints(points: MeasurementPoint[]): MeasurementPoint[] {
  const normalized = points
    .filter((point) => Number.isFinite(point.frequencyHz) && point.frequencyHz > 0)
    .sort((left, right) => left.frequencyHz - right.frequencyHz);

  if (normalized.length < 2) {
    throw new Error('File does not contain enough usable response points.');
  }

  return normalized;
}

function buildPlotPoints(points: MeasurementPoint[]): MeasurementPoint[] {
  if (points.length <= 512) {
    return points;
  }

  return resampleMeasurementPoints(points, 512);
}

function resampleMeasurementPoints(
  points: MeasurementPoint[],
  targetCount: number,
): MeasurementPoint[] {
  const minimumFrequency = points[0]?.frequencyHz ?? DEFAULT_START_FREQUENCY;
  const maximumFrequency = points.at(-1)?.frequencyHz ?? DEFAULT_END_FREQUENCY;
  const resampled: MeasurementPoint[] = [];
  let upperIndex = 1;

  for (let index = 0; index < targetCount; index += 1) {
    const ratio = targetCount === 1 ? 0 : index / (targetCount - 1);
    const frequencyHz =
      minimumFrequency * Math.pow(maximumFrequency / minimumFrequency, ratio);

    while (
      upperIndex < points.length - 1 &&
      points[upperIndex].frequencyHz < frequencyHz
    ) {
      upperIndex += 1;
    }

    const lowerPoint = points[Math.max(0, upperIndex - 1)] ?? points[0];
    const upperPoint = points[upperIndex] ?? points.at(-1) ?? points[0];
    const span = upperPoint.frequencyHz - lowerPoint.frequencyHz;
    const interpolation = span > 0 ? (frequencyHz - lowerPoint.frequencyHz) / span : 0;
    const rawComponents = interpolateMeasurementComponents(
      lowerPoint.magnitudeDbRelative,
      lowerPoint.phaseDegrees,
      upperPoint.magnitudeDbRelative,
      upperPoint.phaseDegrees,
      interpolation,
    );
    const smoothedComponents = interpolateMeasurementComponents(
      lowerPoint.smoothedMagnitudeDbRelative,
      lowerPoint.smoothedPhaseDegrees,
      upperPoint.smoothedMagnitudeDbRelative,
      upperPoint.smoothedPhaseDegrees,
      interpolation,
    );

    resampled.push({
      frequencyHz,
      magnitudeDbRelative: rawComponents.magnitudeDbRelative,
      phaseDegrees: rawComponents.phaseDegrees,
      smoothedMagnitudeDbRelative: smoothedComponents.magnitudeDbRelative,
      smoothedPhaseDegrees: smoothedComponents.phaseDegrees,
    });
  }

  return resampled;
}

function interpolate(start: number, end: number, ratio: number): number {
  return start + (end - start) * clamp(ratio, 0, 1);
}

function interpolateMeasurementComponents(
  startMagnitudeDb: number,
  startPhaseDegrees: number,
  endMagnitudeDb: number,
  endPhaseDegrees: number,
  ratio: number,
): Pick<MeasurementPoint, 'magnitudeDbRelative' | 'phaseDegrees'> {
  const clampedRatio = clamp(ratio, 0, 1);
  const startMagnitude = Math.pow(10, startMagnitudeDb / 20);
  const endMagnitude = Math.pow(10, endMagnitudeDb / 20);
  const startPhaseRadians = (startPhaseDegrees * Math.PI) / 180;
  const endPhaseRadians = (endPhaseDegrees * Math.PI) / 180;
  const interpolatedReal = interpolate(
    startMagnitude * Math.cos(startPhaseRadians),
    endMagnitude * Math.cos(endPhaseRadians),
    clampedRatio,
  );
  const interpolatedImag = interpolate(
    startMagnitude * Math.sin(startPhaseRadians),
    endMagnitude * Math.sin(endPhaseRadians),
    clampedRatio,
  );

  return {
    magnitudeDbRelative:
      20 * Math.log10(Math.hypot(interpolatedReal, interpolatedImag) + 1e-12),
    phaseDegrees: (Math.atan2(interpolatedImag, interpolatedReal) * 180) / Math.PI,
  };
}
