import { app, BrowserWindow } from 'electron';
import path from 'node:path';

function resolveWindowIconPath(): string {
  const iconFileName = process.platform === 'win32' ? 'autocal-icon.ico' : 'autocal-icon.png';

  if (app.isPackaged) {
    return path.join(process.resourcesPath, iconFileName);
  }

  return path.join(app.getAppPath(), 'src', 'assets', iconFileName);
}

export function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 840,
    minWidth: 960,
    minHeight: 720,
    backgroundColor: '#151515',
    darkTheme: true,
    autoHideMenuBar: true,
    icon: resolveWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.removeMenu();

  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === 'media' || permission === 'speaker-selection');
    },
  );

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return mainWindow;
}
