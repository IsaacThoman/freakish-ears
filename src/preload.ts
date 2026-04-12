import { contextBridge, ipcRenderer } from 'electron';

type SaveMeasurementFile = {
  name: string;
  contents: Uint8Array;
};

type SaveMeasurementPayload = {
  folderPath: string;
  sessionName: string;
  files: SaveMeasurementFile[];
};

contextBridge.exposeInMainWorld('freakishEars', {
  selectOutputFolder: () => ipcRenderer.invoke('dialog:selectOutputFolder'),
  saveMeasurementSession: (payload: SaveMeasurementPayload) =>
    ipcRenderer.invoke('files:saveMeasurementSession', payload),
});
