export const IPC_CHANNELS = {
  selectOutputFolder: 'dialog:selectOutputFolder',
  saveMeasurementSession: 'files:saveMeasurementSession',
  showItemInFolder: 'files:showItemInFolder',
  runSoxMeasurement: 'measurement:runSoxMeasurement',
  analyzeMeasurement: 'measurement:analyzeMeasurement',
} as const;

export type MeasurementBackend = 'web-audio' | 'sox';

export type MeasurementChannelSelection = 'left' | 'right' | 'both';

export type FolderSelectionResult = {
  canceled: boolean;
  folderPath: string | null;
};

export type SaveMeasurementFile = {
  name: string;
  contents: Uint8Array;
};

export type SaveMeasurementPayload = {
  folderPath: string;
  sessionName: string;
  files: SaveMeasurementFile[];
};

export type SaveMeasurementResult = {
  sessionDirectory: string;
  filePaths: string[];
};

export type MeasurementPoint = {
  frequencyHz: number;
  magnitudeDbRelative: number;
  phaseDegrees: number;
  smoothedMagnitudeDbRelative: number;
  smoothedPhaseDegrees: number;
};

export type MeasurementCapture = {
  recording: Float32Array;
  sweep: Float32Array;
  sampleRate: number;
  preRollSamples: number;
};

export type MeasurementAnalysis = {
  sampleRate: number;
  sweepStartSample: number;
  latencyMs: number;
  recordingLengthSeconds: number;
  peakDbfs: number;
  rmsDbfs: number;
  points: MeasurementPoint[];
};

export type RunSoxMeasurementPayload = {
  startFrequency: number;
  endFrequency: number;
  durationSeconds: number;
  sweepLevelDb: number;
  sampleRate: number;
  inputChannel: MeasurementChannelSelection;
  outputChannel: MeasurementChannelSelection;
  preRollSeconds: number;
  postRollSeconds: number;
};

export type RunSoxMeasurementResult = {
  recording: Float32Array;
  recordingWav: Uint8Array;
  sweep: Float32Array;
  sampleRate: number;
  preRollSamples: number;
};

export type AnalyzeMeasurementPayload = {
  capture: MeasurementCapture;
  startFrequency: number;
  endFrequency: number;
};

export type FreakishEarsApi = {
  selectOutputFolder: () => Promise<FolderSelectionResult>;
  saveMeasurementSession: (
    payload: SaveMeasurementPayload,
  ) => Promise<SaveMeasurementResult>;
  showItemInFolder: (filePath: string) => Promise<void>;
  runSoxMeasurement: (
    payload: RunSoxMeasurementPayload,
  ) => Promise<RunSoxMeasurementResult>;
  analyzeMeasurement: (
    payload: AnalyzeMeasurementPayload,
  ) => Promise<MeasurementAnalysis>;
};
