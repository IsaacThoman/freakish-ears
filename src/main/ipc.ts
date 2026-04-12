import { dialog, ipcMain, shell } from 'electron';

import { analyzeMeasurement } from './measurement-analysis';
import { saveMeasurementSession } from './files';
import { runSoxMeasurement } from './sox';
import { IPC_CHANNELS } from '../shared/ipc';
import type {
  AnalyzeMeasurementPayload,
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

  ipcMain.handle(
    IPC_CHANNELS.analyzeMeasurement,
    async (_event, payload: AnalyzeMeasurementPayload) =>
      analyzeMeasurement(
        payload.capture,
        payload.startFrequency,
        payload.endFrequency,
      ),
  );
}
