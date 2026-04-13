export const IPC_CHANNELS = {
  selectOutputFolder: 'dialog:selectOutputFolder',
  saveMeasurementSession: 'files:saveMeasurementSession',
  saveFileAs: 'files:saveFileAs',
  showItemInFolder: 'files:showItemInFolder',
  runSoxMeasurement: 'measurement:runSoxMeasurement',
  getEqualizerApoStatus: 'equalizerApo:getStatus',
  applyEqualizerApoConfig: 'equalizerApo:applyConfig',
  disablePeace: 'equalizerApo:disablePeace',
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

export type SaveFileAsPayload = {
  title: string;
  suggestedName: string;
  defaultFolderPath: string | null;
  contents: Uint8Array;
};

export type SaveFileAsResult = {
  canceled: boolean;
  filePath: string | null;
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

export type EqualizerApoStatus = {
  installed: boolean;
  configFolderPath: string | null;
  configPath: string | null;
  profilePath: string | null;
  peaceInstalled: boolean;
  peaceRunning: boolean;
  peaceIncludedInConfig: boolean;
  freakishEarsIncludedInConfig: boolean;
};

export type ApplyEqualizerApoConfigPayload = {
  configText: string;
};

export type ApplyEqualizerApoConfigResult = {
  configPath: string;
  profilePath: string;
};

export type DisablePeaceResult = {
  disabled: boolean;
  processKilled: boolean;
};

export type FreakishEarsApi = {
  selectOutputFolder: () => Promise<FolderSelectionResult>;
  saveMeasurementSession: (
    payload: SaveMeasurementPayload,
  ) => Promise<SaveMeasurementResult>;
  saveFileAs: (payload: SaveFileAsPayload) => Promise<SaveFileAsResult>;
  showItemInFolder: (filePath: string) => Promise<void>;
  runSoxMeasurement: (
    payload: RunSoxMeasurementPayload,
  ) => Promise<RunSoxMeasurementResult>;
  getEqualizerApoStatus: () => Promise<EqualizerApoStatus>;
  applyEqualizerApoConfig: (
    payload: ApplyEqualizerApoConfigPayload,
  ) => Promise<ApplyEqualizerApoConfigResult>;
  disablePeace: () => Promise<DisablePeaceResult>;
};
