import type { EqualizerApoStatus } from '../shared/ipc';

export type ToastState = {
  message: string;
  actionLabel: string;
  actionPath: string;
};

export type MeasurementPoint = {
  frequencyHz: number;
  magnitudeDbRelative: number;
  phaseDegrees: number;
  smoothedMagnitudeDbRelative: number;
  smoothedPhaseDegrees: number;
};

export type MeasurementMagnitudeMode = 'relative' | 'spl';

export type MeasurementBackend = 'web-audio' | 'sox';
export type MeasurementChannelSelection = 'left' | 'right' | 'both';
export type MeasurementSmoothingMode = 'raw' | `1/${number}`;

export type MeasurementAnalysis = {
  sampleRate: number;
  sweepStartSample: number;
  latencyMs: number;
  recordingLengthSeconds: number;
  peakDbfs: number;
  rmsDbfs: number;
  points: MeasurementPoint[];
};

export type MeasurementSummary = {
  latencyMs: number | null;
  peakDbfs: number | null;
  rmsDbfs: number | null;
  savedPath: string | null;
};

export type LoadedMeasurement = {
  id: string;
  name: string;
  exportName: string;
  color: string;
  starred: boolean;
  visible: boolean;
  magnitudeMode: MeasurementMagnitudeMode;
  sourcePath: string | null;
  summary: MeasurementSummary;
  points: MeasurementPoint[];
  plotPoints: MeasurementPoint[];
};

export type ReferenceCurve = LoadedMeasurement;

export type ResponsePlotGeometry = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  minFrequency: number;
  maxFrequency: number;
  minDb: number;
  maxDb: number;
};

export type MeasurementCapture = {
  recording: Float32Array;
  sweep: Float32Array;
  sampleRate: number;
  preRollSamples: number;
};

export type LogTone = 'neutral' | 'success' | 'error';
export type StatusTone = 'idle' | 'working' | 'success' | 'error';

export type MeasurementImport = {
  name: string;
  exportName: string;
  magnitudeMode: MeasurementMagnitudeMode;
  sourcePath: string | null;
  points: MeasurementPoint[];
  summary: MeasurementSummary;
};

export type ApoFilterKind =
  | 'PK'
  | 'LP'
  | 'HP'
  | 'BP'
  | 'LS'
  | 'HS'
  | 'NO'
  | 'AP'
  | 'LSC_DB'
  | 'HSC_DB'
  | 'LPBW'
  | 'HPBW'
  | 'LPLR'
  | 'HPLR'
  | 'LSQ'
  | 'HSQ'
  | 'LSCQ'
  | 'HSCQ';

export type ApoEqMode = 'parametric' | 'graphic';
export type AutomationAlgorithm = 'proportional' | 'pid' | 'damped-refit' | 'momentum';
export type AutomationToleranceBand =
  | 'subBass'
  | 'bass'
  | 'lowMid'
  | 'mid'
  | 'upMid'
  | 'presence'
  | 'brilliance';
export type AutomationBandTolerances = Record<AutomationToleranceBand, number>;

export type ApoFilter = {
  id: string;
  enabled: boolean;
  kind: ApoFilterKind;
  frequencyHz: number;
  gainDb: number;
  q: number;
  order: number | null;
  slopeDbPerOct: number | null;
};

export type PlotViewMode = 'measurements' | 'apo';

export type AppState = {
  busy: boolean;
  outputFolder: string | null;
  measurementBackend: MeasurementBackend;
  measurementKeepCount: number;
  splOffsetDb: number;
  normalizePlot: boolean;
  smoothingMode: MeasurementSmoothingMode;
  measurements: LoadedMeasurement[];
  referenceCurves: ReferenceCurve[];
  focusedMeasurementId: string | null;
  nextMeasurementIndex: number;
  nextReferenceIndex: number;
  apoEqMode: ApoEqMode;
  parametricApoFilters: ApoFilter[];
  graphicApoFilters: ApoFilter[];
  automationAlgorithm: AutomationAlgorithm;
  automationDelaySeconds: number;
  proportionalP: number;
  dynamicProportionalP: boolean;
  pidProportionalGain: number;
  pidIntegralGain: number;
  pidDerivativeGain: number;
  dampedRefitBlend: number;
  momentumBlend: number;
  momentumDecay: number;
  automationStopOnTolerance: boolean;
  automationBandTolerances: AutomationBandTolerances;
  automationToleranceMaxAcceptableErrorWidthHz: number;
  automationRegressionLimit: number;
  latestAutomationToleranceStatus: string | null;
  automationRunning: boolean;
  automationStopRequested: boolean;
  automationPassCount: number;
  automationPidIntegralByBand: Record<string, number>;
  automationPidPreviousErrorByBand: Record<string, number>;
  automationMomentumByBand: Record<string, number>;
  apoSelectedMeasurementId: string | null;
  apoSelectedReferenceId: string | null;
  parametricApoMaxFilters: number;
  graphicApoMaxFilters: number;
  parametricApoImportedPreampDb: number | null;
  graphicApoImportedPreampDb: number | null;
  parametricApoImportedBlockRepeatCount: number | null;
  graphicApoImportedBlockRepeatCount: number | null;
  apoMaxBoostDb: number;
  apoMaxCutDb: number;
  nextApoFilterIndex: number;
  apoFilterListPage: number;
  apoFilterListPageSize: number;
  latestStatusMessage: string;
  latestStatusTone: StatusTone;
  equalizerApoStatus: EqualizerApoStatus | null;
  toast: ToastState | null;
  toastTimeoutId: number;
};
