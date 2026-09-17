const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// Configure Auto-Updater
autoUpdater.autoDownload = false; // Let user or UI initiate download
autoUpdater.autoInstallOnAppQuit = true;

function sendToWindow(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'Krushi Seva ERP - कृषी सेवा केंद्र ERP',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    show: false,
  });

  // Smooth loading
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 3000);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showFallback);
    mainWindow.show();
    // Check for updates shortly after launch if packaged
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
          console.error('Initial update check error:', err);
        });
      }, 5000);
    }
  });

  // Enable F12 or Ctrl+Shift+I to toggle DevTools if ever needed
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Failed to load URL: ${validatedURL} (${errorCode}: ${errorDescription})`);
  });

  // Open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Remove default menu for clean modern ERP look, or keep minimal
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// =======================
// Electron Updater Events
// =======================

autoUpdater.on('checking-for-update', () => {
  console.log('[AutoUpdater] Checking for updates...');
  sendToWindow('update-checking', {});
});

autoUpdater.on('update-available', (info) => {
  console.log('[AutoUpdater] Update available:', info.version);
  sendToWindow('update-available', {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes,
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[AutoUpdater] App is up to date.');
  sendToWindow('update-not-available', {
    version: info ? info.version : app.getVersion(),
  });
});

autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] Error in auto-updater:', err);
  sendToWindow('update-error', {
    message: err == null ? 'Unknown update error' : (err.message || err.toString()),
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`[AutoUpdater] Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`);
  sendToWindow('download-progress', {
    percent: Math.round(progressObj.percent || 0),
    transferred: progressObj.transferred,
    total: progressObj.total,
    bytesPerSecond: progressObj.bytesPerSecond,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[AutoUpdater] Update downloaded successfully:', info.version);
  sendToWindow('update-downloaded', {
    version: info.version,
  });
});

// =======================
// IPC Communication Handlers
// =======================

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('is-electron', () => {
  return true;
});

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return {
      status: 'dev_mode',
      message: 'Running in development mode. Updates are enabled in release build.',
      version: app.getVersion(),
    };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      status: 'success',
      updateInfo: result ? result.updateInfo : null,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message || 'Error checking for updates',
    };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { status: 'downloading' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

// App Lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
