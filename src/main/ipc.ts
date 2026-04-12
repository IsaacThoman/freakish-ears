import { dialog, ipcMain, shell } from 'electron';

import { applyEqualizerApoConfig, disablePeace, getEqualizerApoStatus, saveMeasurementSession } from './files';
import { runSoxMeasurement } from './sox';
import { IPC_CHANNELS } from '../shared/ipc';
import type {
  ApplyEqualizerApoConfigPayload,
  RunSoxMeasurementPayload,
  SaveMeasurementPayload,
} from '../shared/ipc';

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.selectOutputFolder, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a folder for recordings and values',
      properties: ['openDirectory', 'createDirectory'],
    });

    return {
      canceled: result.canceled,
      folderPath: result.canceled ? null : result.filePaths[0] ?? null,
    };
  });

  ipcMain.handle(
    IPC_CHANNELS.saveMeasurementSession,
    async (_event, payload: SaveMeasurementPayload) =>
      saveMeasurementSession(payload),
  );

  ipcMain.handle(IPC_CHANNELS.showItemInFolder, async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle(
    IPC_CHANNELS.runSoxMeasurement,
    async (_event, payload: RunSoxMeasurementPayload) => runSoxMeasurement(payload),
  );

  ipcMain.handle(IPC_CHANNELS.getEqualizerApoStatus, async () => getEqualizerApoStatus());

  ipcMain.handle(
    IPC_CHANNELS.applyEqualizerApoConfig,
    async (_event, payload: ApplyEqualizerApoConfigPayload) => applyEqualizerApoConfig(payload),
  );

  ipcMain.handle(IPC_CHANNELS.disablePeace, async () => disablePeace());
}
