import { dialog, ipcMain, shell } from 'electron';

import { saveMeasurementSession } from './files';
import { IPC_CHANNELS } from '../shared/ipc';
import type { SaveMeasurementPayload } from '../shared/ipc';

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
}
