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
  visible: boolean;
  magnitudeMode: MeasurementMagnitudeMode;
  sourcePath: string | null;
  summary: MeasurementSummary;
  points: MeasurementPoint[];
  plotPoints: MeasurementPoint[];
};

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

export type AppState = {
  busy: boolean;
  outputFolder: string | null;
  splOffsetDb: number;
  normalizePlot: boolean;
  measurements: LoadedMeasurement[];
  focusedMeasurementId: string | null;
  nextMeasurementIndex: number;
  toast: ToastState | null;
  toastTimeoutId: number;
};
