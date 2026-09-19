const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let downloadedDirectInstaller = null;
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// Configure Auto-Updater - auto download enabled so no manual button is needed
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function sendToWindow(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// Helper to download direct installer from GitHub Release asset (handles redirects)
function downloadDirectAsset(url, targetVersion) {
  const tempFile = path.join(os.tmpdir(), `Krushi-Seva-Setup-${targetVersion || 'latest'}.exe`);
  
  const follow = (currentUrl, redirectCount = 0) => {
    if (redirectCount > 6) {
      sendToWindow('update-error', { message: 'Too many redirects during update download' });
      return;
    }
    
    try {
      const parsed = new URL(currentUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      
      const req = client.get(currentUrl, {
        headers: { 'User-Agent': 'KrushiSevaERP-AutoUpdater' }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, redirectCount + 1);
        }
        
        if (res.statusCode !== 200) {
          sendToWindow('update-error', { message: `Update download failed with HTTP status ${res.statusCode}` });
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let transferred = 0;
        let lastTime = Date.now();
        let lastTransferred = 0;

        const fileStream = fs.createWriteStream(tempFile);
        
        res.on('data', (chunk) => {
          transferred += chunk.length;
          const now = Date.now();
          if (now - lastTime >= 350 || transferred === total) {
            const deltaSec = (now - lastTime) / 1000;
            const bytesPerSecond = deltaSec > 0 ? (transferred - lastTransferred) / deltaSec : 0;
            const percent = total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0;
            sendToWindow('download-progress', {
              percent,
              transferred,
              total,
              bytesPerSecond
            });
            lastTime = now;
            lastTransferred = transferred;
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            downloadedDirectInstaller = tempFile;
            sendToWindow('update-downloaded', { version: targetVersion });
          });
        });

        fileStream.on('error', (err) => {
          fs.unlink(tempFile, () => {});
          sendToWindow('update-error', { message: err.message || 'File write error during update' });
        });
      });

      req.on('error', (err) => {
        sendToWindow('update-error', { message: err.message || 'Network error during update' });
      });
    } catch (e) {
      sendToWindow('update-error', { message: e.message || 'Error initiating download' });
    }
  };

  follow(url);
}

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, 'icon.ico')) 
    ? path.join(__dirname, 'icon.ico') 
    : path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'Krushi Seva ERP - कृषी सेवा केंद्र ERP',
    icon: iconPath,
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

ipcMain.handle('download-and-install-direct', async (_event, { downloadUrl, version }) => {
  if (!downloadUrl) {
    return { status: 'error', message: 'No download URL provided' };
  }
  try {
    downloadDirectAsset(downloadUrl, version);
    return { status: 'downloading' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('quit-and-install', () => {
  if (downloadedDirectInstaller && fs.existsSync(downloadedDirectInstaller)) {
    try {
      const child = spawn(downloadedDirectInstaller, [], { detached: true, stdio: 'ignore' });
      child.unref();
      setTimeout(() => {
        app.quit();
      }, 600);
      return;
    } catch (e) {
      console.error('Failed to launch downloaded installer:', e);
    }
  }
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
