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
let isDownloading = false;
let isUpdateReady = false;
let latestDetectedVersion = null;
let periodicCheckTimer = null;
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// Configure Auto-Updater - auto download enabled so no manual button is needed
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;
autoUpdater.allowDowngrade = false;
try {
  autoUpdater.logger = console;
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'devrupeshgadkhe',
    repo: 'Repo_KrushiSeva',
    private: false,
  });
} catch (e) {
  console.warn('[AutoUpdater] Feed URL configuration note:', e.message);
}

function sendToWindow(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// Compare semantic version strings (e.g. '1.0.12' vs '1.0.13')
function isNewerVersion(current, latest) {
  if (!current || !latest) return false;
  const cleanCurrent = String(current).replace(/^v/, '').trim();
  const cleanLatest = String(latest).replace(/^v/, '').trim();
  if (cleanCurrent === cleanLatest) return false;

  const cParts = cleanCurrent.split('.').map((p) => parseInt(p, 10) || 0);
  const lParts = cleanLatest.split('.').map((p) => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
    const c = cParts[i] || 0;
    const l = lParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

// Direct check against latest.yml on GitHub Releases CDN (no GitHub API rate limit!)
function checkLatestYmlUpdate() {
  const latestYmlUrl = `https://github.com/devrupeshgadkhe/Repo_KrushiSeva/releases/latest/download/latest.yml?t=${Date.now()}`;
  
  const follow = (url, count = 0) => {
    if (count > 6) return;
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      client.get(url, { headers: { 'User-Agent': 'KrushiSevaERP-AutoUpdater' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, count + 1);
        }
        if (res.statusCode !== 200) return;

        let content = '';
        res.on('data', chunk => { content += chunk; });
        res.on('end', () => {
          try {
            const verMatch = content.match(/version:\s*([^\s\r\n]+)/);
            if (!verMatch || !verMatch[1]) return;
            const remoteVersion = verMatch[1].trim();
            latestDetectedVersion = remoteVersion;

            const pathMatch = content.match(/path:\s*([^\s\r\n]+)/) || content.match(/url:\s*([^\s\r\n]+)/);
            const exeFileName = pathMatch ? pathMatch[1].trim() : `Krushi-Seva-ERP-Setup-${remoteVersion}.exe`;

            const currentVersion = app.getVersion();
            if (isNewerVersion(currentVersion, remoteVersion)) {
              console.log(`[AutoUpdater] Direct latest.yml detected newer version: v${remoteVersion} (current: v${currentVersion})`);
              sendToWindow('update-available', {
                version: remoteVersion,
                releaseNotes: `New release v${remoteVersion} available`,
              });

              // Automatically start background download without requiring manual intervention
              if (!isDownloading && !isUpdateReady) {
                const downloadUrl = `https://github.com/devrupeshgadkhe/Repo_KrushiSeva/releases/download/v${remoteVersion}/${exeFileName}`;
                console.log(`[AutoUpdater] Starting automated direct asset download from: ${downloadUrl}`);
                downloadDirectAsset(downloadUrl, remoteVersion);
              }
            } else {
              console.log(`[AutoUpdater] App is up to date (current: v${currentVersion}, remote: v${remoteVersion})`);
              sendToWindow('update-not-available', { version: currentVersion });
            }
          } catch (e) {
            console.warn('[AutoUpdater] Failed parsing latest.yml response:', e.message);
          }
        });
      }).on('error', (err) => {
        console.warn('[AutoUpdater] latest.yml network check error:', err.message);
      });
    } catch (err) {
      console.warn('[AutoUpdater] latest.yml URL error:', err.message);
    }
  };

  follow(latestYmlUrl);
}

// Master updater trigger: runs electron-updater AND latest.yml check
function triggerUpdateCheck() {
  if (isDownloading || isUpdateReady) return;
  console.log('[AutoUpdater] Triggering update check...');
  sendToWindow('update-checking', {});

  if (app.isPackaged) {
    try {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('[AutoUpdater] autoUpdater.checkForUpdates warning:', err.message);
      });
    } catch (e) {
      console.warn('[AutoUpdater] autoUpdater call error:', e.message);
    }
  }

  // Always perform direct latest.yml check
  checkLatestYmlUpdate();
}

// Helper to download direct installer from GitHub Release asset (handles redirects)
function downloadDirectAsset(url, targetVersion) {
  if (isDownloading) return;
  isDownloading = true;

  const tempFile = path.join(os.tmpdir(), `Krushi-Seva-Setup-${targetVersion || 'latest'}.exe`);
  
  const follow = (currentUrl, redirectCount = 0) => {
    if (redirectCount > 8) {
      isDownloading = false;
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
          isDownloading = false;
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
          if (now - lastTime >= 300 || transferred === total) {
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
            isDownloading = false;
            isUpdateReady = true;
            downloadedDirectInstaller = tempFile;
            console.log(`[AutoUpdater] Download completed to ${tempFile}, notifying renderer`);
            sendToWindow('update-downloaded', { version: targetVersion || latestDetectedVersion });
          });
        });

        fileStream.on('error', (err) => {
          isDownloading = false;
          fs.unlink(tempFile, () => {});
          sendToWindow('update-error', { message: err.message || 'File write error during update' });
        });
      });

      req.on('error', (err) => {
        isDownloading = false;
        sendToWindow('update-error', { message: err.message || 'Network error during update' });
      });
    } catch (e) {
      isDownloading = false;
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
    // Check for updates shortly after launch
    setTimeout(() => {
      triggerUpdateCheck();
    }, 3000);

    // Periodic check every 60 seconds whenever internet is active
    if (periodicCheckTimer) clearInterval(periodicCheckTimer);
    periodicCheckTimer = setInterval(() => {
      triggerUpdateCheck();
    }, 60 * 1000);
  });

  // Re-check for updates whenever window regains user focus
  mainWindow.on('focus', () => {
    triggerUpdateCheck();
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
    if (periodicCheckTimer) {
      clearInterval(periodicCheckTimer);
      periodicCheckTimer = null;
    }
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
  console.log('[AutoUpdater] Update available via autoUpdater:', info.version);
  latestDetectedVersion = info.version;
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
  console.warn('[AutoUpdater] autoUpdater error:', err && err.message ? err.message : err);
  // Do not show disruptive modal on background check fail; direct latest.yml check handles fallback
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
  console.log('[AutoUpdater] Update downloaded successfully via autoUpdater:', info.version);
  isUpdateReady = true;
  isDownloading = false;
  sendToWindow('update-downloaded', {
    version: info.version || latestDetectedVersion,
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
  try {
    triggerUpdateCheck();
    return {
      status: 'checking',
      version: app.getVersion(),
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
  console.log('[AutoUpdater] quit-and-install triggered');
  if (downloadedDirectInstaller && fs.existsSync(downloadedDirectInstaller)) {
    try {
      console.log(`[AutoUpdater] Launching silent NSIS installer: ${downloadedDirectInstaller}`);
      // Launch installer silently (/S) so it installs without requiring manual next-clicks
      const child = spawn(downloadedDirectInstaller, ['/S'], { detached: true, stdio: 'ignore' });
      child.unref();
      setTimeout(() => {
        app.quit();
      }, 600);
      return;
    } catch (e) {
      console.error('Failed to launch downloaded silent installer:', e);
    }
  }

  try {
    autoUpdater.quitAndInstall(true, true);
  } catch (err) {
    console.error('autoUpdater.quitAndInstall error:', err);
  }
});

// ============================================
// Automated Backup: Local & Cloud Synchronization
// ============================================
ipcMain.handle('send-cloud-backup', async (_event, payload) => {
  const result = { localSaved: false, cloudSaved: false, localPath: '', message: '', timestamp: new Date().toISOString() };

  // 1. Save locally to app data / backups directory in desktop app
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const filename = payload.filename || `krushi_seva_erp_backup_${new Date().toISOString().slice(0, 10)}.json`;
    const localFilePath = path.join(backupDir, filename);
    const content = typeof payload.content === 'string' ? payload.content : JSON.stringify(payload.data || payload, null, 2);
    fs.writeFileSync(localFilePath, content, 'utf8');
    result.localSaved = true;
    result.localPath = localFilePath;

    // Keep only last 15 local backup files to conserve disk space
    try {
      const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);
      if (files.length > 15) {
        for (let i = 15; i < files.length; i++) {
          fs.unlinkSync(path.join(backupDir, files[i].name));
        }
      }
    } catch (cleanErr) {
      console.warn('Backup cleanup error:', cleanErr);
    }
  } catch (localErr) {
    console.warn('Local backup save error:', localErr);
  }

  // 2. Transmit to Google Apps Script / Google Drive
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbyAYKVB5xsVTtyKjQv1R-9sSRKsCJo8VZFHZPgqCaKOHZYpbRQJI_PgFvGACKZ32r8/exec';
  try {
    const dataStr = JSON.stringify(payload);
    const cloudRes = await new Promise((resolve) => {
      const parsed = new URL(GAS_URL);
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          'Content-Length': Buffer.byteLength(dataStr)
        },
        timeout: 20000
      };

      const req = https.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          https.get(res.headers.location, (redRes) => {
            let body = '';
            redRes.on('data', chunk => body += chunk);
            redRes.on('end', () => resolve({ success: true, status: redRes.statusCode }));
          }).on('error', (err) => resolve({ success: false, message: err.message }));
          return;
        }
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({ success: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
        });
      });

      req.on('error', (err) => resolve({ success: false, message: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, message: 'Timeout' });
      });
      req.write(dataStr);
      req.end();
    });

    result.cloudSaved = cloudRes.success;
    result.status = cloudRes.status;
  } catch (cloudErr) {
    result.cloudSaved = false;
    result.message = cloudErr.message;
  }

  return { success: result.localSaved || result.cloudSaved, ...result };
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
