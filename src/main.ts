import { app, BrowserWindow, nativeTheme } from 'electron';
import started from 'electron-squirrel-startup';
import {
  isHeadlessMeasurementMode,
  runHeadlessMeasurementMode,
} from './main/headless';
import { registerIpcHandlers } from './main/ipc';
import { createWindow } from './main/window';

if (started) {
  app.quit();
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.squirrel.autocal.autocal');
}

nativeTheme.themeSource = 'dark';

registerIpcHandlers();

const headlessMeasurementMode = isHeadlessMeasurementMode(process.argv);

app.on('ready', () => {
  if (headlessMeasurementMode) {
    void runHeadlessMeasurementMode(process.argv).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[autocal] Headless measurement failed: ${message}`);
      app.exit(1);
    });
    return;
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (!headlessMeasurementMode && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (!headlessMeasurementMode && BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
