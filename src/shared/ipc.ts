export const IPC_CHANNELS = {
  selectOutputFolder: 'dialog:selectOutputFolder',
  saveMeasurementSession: 'files:saveMeasurementSession',
  showItemInFolder: 'files:showItemInFolder',
} as const;

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

export type FreakishEarsApi = {
  selectOutputFolder: () => Promise<FolderSelectionResult>;
  saveMeasurementSession: (
    payload: SaveMeasurementPayload,
  ) => Promise<SaveMeasurementResult>;
  showItemInFolder: (filePath: string) => Promise<void>;
};
