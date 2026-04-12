import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/ipc';
import type {
  ApplyEqualizerApoConfigPayload,
  FreakishEarsApi,
  RunSoxMeasurementPayload,
  SaveMeasurementPayload,
} from './shared/ipc';

const api: FreakishEarsApi = {
  selectOutputFolder: () => ipcRenderer.invoke(IPC_CHANNELS.selectOutputFolder),
  saveMeasurementSession: (payload: SaveMeasurementPayload) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveMeasurementSession, payload),
  showItemInFolder: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.showItemInFolder, filePath),
  runSoxMeasurement: (payload: RunSoxMeasurementPayload) =>
    ipcRenderer.invoke(IPC_CHANNELS.runSoxMeasurement, payload),
  getEqualizerApoStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getEqualizerApoStatus),
  applyEqualizerApoConfig: (payload: ApplyEqualizerApoConfigPayload) =>
    ipcRenderer.invoke(IPC_CHANNELS.applyEqualizerApoConfig, payload),
  disablePeace: () => ipcRenderer.invoke(IPC_CHANNELS.disablePeace),
};

contextBridge.exposeInMainWorld('freakishEars', api);
