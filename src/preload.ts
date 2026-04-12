import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/ipc';
import type { FreakishEarsApi, SaveMeasurementPayload } from './shared/ipc';

const api: FreakishEarsApi = {
  selectOutputFolder: () => ipcRenderer.invoke(IPC_CHANNELS.selectOutputFolder),
  saveMeasurementSession: (payload: SaveMeasurementPayload) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveMeasurementSession, payload),
  showItemInFolder: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.showItemInFolder, filePath),
};

contextBridge.exposeInMainWorld('freakishEars', api);
