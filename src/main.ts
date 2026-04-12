import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

type SaveMeasurementFile = {
  name: string;
  contents: Uint8Array;
};

type SaveMeasurementPayload = {
  folderPath: string;
  sessionName: string;
  files: SaveMeasurementFile[];
};

const sanitizePathSegment = (value: string) => {
  const sanitized = Array.from(value.trim(), (character) => {
    const codePoint = character.charCodeAt(0);

    if (
      codePoint < 32 ||
      '<>:"/\\|?*'.includes(character) ||
      /\s/.test(character)
    ) {
      return '-';
    }

    return character;
  })
    .join('')
    .replace(/-+/g, '-')
    .slice(0, 120);

  return sanitized || 'measurement';
};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 840,
    minWidth: 960,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === 'media' || permission === 'speaker-selection');
    },
  );

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

ipcMain.handle('dialog:selectOutputFolder', async () => {
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
  'files:saveMeasurementSession',
  async (_event, payload: SaveMeasurementPayload) => {
    const sessionDirectory = path.join(
      payload.folderPath,
      sanitizePathSegment(payload.sessionName),
    );

    await mkdir(sessionDirectory, { recursive: true });

    const filePaths: string[] = [];

    for (const file of payload.files) {
      const filePath = path.join(
        sessionDirectory,
        sanitizePathSegment(file.name),
      );

      await writeFile(filePath, Buffer.from(file.contents));
      filePaths.push(filePath);
    }

    return {
      sessionDirectory,
      filePaths,
    };
  },
);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
