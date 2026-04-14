import { dialog, ipcMain, shell } from 'electron';
import path from 'node:path';

import {
  applyEqualizerApoConfig,
  deleteMeasurementSession,
  disablePeace,
  getEqualizerApoStatus,
  listPeacePresets,
  readPeacePreset,
  saveFileAtPath,
  saveMeasurementSession,
} from './files';
import { runSoxMeasurement } from './sox';
import { IPC_CHANNELS } from '../shared/ipc';
import type {
  ApplyEqualizerApoConfigPayload,
  RunSoxMeasurementPayload,
  SaveFileAsPayload,
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

  ipcMain.handle(
    IPC_CHANNELS.deleteMeasurementSession,
    async (_event, sessionDirectory: string) => deleteMeasurementSession(sessionDirectory),
  );

  ipcMain.handle(IPC_CHANNELS.saveFileAs, async (_event, payload: SaveFileAsPayload) => {
    const result = await dialog.showSaveDialog({
      title: payload.title,
      defaultPath: payload.defaultFolderPath
        ? path.join(payload.defaultFolderPath, payload.suggestedName)
        : payload.suggestedName,
    });

    if (result.canceled || !result.filePath) {
      return {
        canceled: true,
        filePath: null,
      };
    }

    return {
      canceled: false,
      filePath: await saveFileAtPath(result.filePath, payload.contents),
    };
  });

  ipcMain.handle(IPC_CHANNELS.showItemInFolder, async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle(
    IPC_CHANNELS.runSoxMeasurement,
    async (_event, payload: RunSoxMeasurementPayload) => runSoxMeasurement(payload),
  );

  ipcMain.handle(IPC_CHANNELS.getEqualizerApoStatus, async () => getEqualizerApoStatus());

  ipcMain.handle(IPC_CHANNELS.listPeacePresets, async () => listPeacePresets());

  ipcMain.handle(IPC_CHANNELS.readPeacePreset, async (_event, fileName: string) =>
    readPeacePreset(fileName),
  );

  ipcMain.handle(
    IPC_CHANNELS.applyEqualizerApoConfig,
    async (_event, payload: ApplyEqualizerApoConfigPayload) => applyEqualizerApoConfig(payload),
  );

  ipcMain.handle(IPC_CHANNELS.disablePeace, async () => disablePeace());
}
