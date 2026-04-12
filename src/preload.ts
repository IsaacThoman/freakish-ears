import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/ipc';
import type {
  AnalyzeMeasurementPayload,
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
  analyzeMeasurement: (payload: AnalyzeMeasurementPayload) =>
    ipcRenderer.invoke(IPC_CHANNELS.analyzeMeasurement, payload),
};

contextBridge.exposeInMainWorld('freakishEars', api);
