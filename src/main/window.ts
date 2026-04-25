import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const APP_ASPECT_RATIO = 16 / 10;

type CreateWindowOptions = {
  width?: number;
  height?: number;
  show?: boolean;
};

function resolveWindowIconPath(): string {
  const iconFileName = process.platform === 'win32' ? 'autocal-icon.ico' : 'autocal-icon.png';

  if (app.isPackaged) {
    return path.join(process.resourcesPath, iconFileName);
  }

  return path.join(app.getAppPath(), 'src', 'assets', iconFileName);
}

export function createWindow(options: CreateWindowOptions = {}): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: options.width ?? 1180,
    height: options.height ?? 840,
    minWidth: 960,
    minHeight: 720,
    resizable: false,
    maximizable: false,
    backgroundColor: '#151515',
    darkTheme: true,
    autoHideMenuBar: true,
    icon: resolveWindowIconPath(),
    show: options.show ?? true,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });

  mainWindow.setAspectRatio(APP_ASPECT_RATIO);

  mainWindow.on('enter-full-screen', () => {
    mainWindow.setAspectRatio(0);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow.setAspectRatio(APP_ASPECT_RATIO);
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
