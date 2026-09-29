const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

// Load environment variables for Desktop App
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '../.env') });
  dotenv.config();
} catch (e) {
  console.warn('[DesktopApp] Dotenv note:', e.message);
}

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
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: false,
    },
    show: false,
  });

  // Smooth loading without white flash
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 3500);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showFallback);
    mainWindow.show();
    // Check for updates shortly after launch
    setTimeout(() => {
      triggerUpdateCheck();
    }, 3000);

    // Continuous periodic update check every 30 seconds
    if (periodicCheckTimer) clearInterval(periodicCheckTimer);
    periodicCheckTimer = setInterval(() => {
      triggerUpdateCheck();
    }, 30 * 1000);
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
    if (errorCode !== -3) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const indexPath = path.join(__dirname, '../dist/index.html');
          if (fs.existsSync(indexPath)) {
            mainWindow.loadFile(indexPath);
          }
        }
      }, 1500);
    }
  });

  mainWindow.on('unresponsive', () => {
    console.warn('[Electron] Window became unresponsive');
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Electron] Render process gone:', details.reason);
    if (details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
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
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('[Electron] Failed to loadFile:', err);
    });
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

// Handler for loading SQL.js WASM binary directly from filesystem in desktop app
ipcMain.handle('get-sql-wasm-binary', async () => {
  try {
    const candidatePaths = [
      path.join(__dirname, '../dist/sql-wasm.wasm'),
      path.join(__dirname, 'sql-wasm.wasm'),
      path.join(app.getAppPath(), 'dist/sql-wasm.wasm'),
      path.join(app.getAppPath(), 'public/sql-wasm.wasm'),
      process.resourcesPath ? path.join(process.resourcesPath, 'sql-wasm.wasm') : null,
      process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked/dist/sql-wasm.wasm') : null
    ].filter(Boolean);

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p);
      }
    }
  } catch (e) {
    console.error('[Electron] Failed to read sql-wasm.wasm binary:', e);
  }
  return null;
});

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
      console.log(`[AutoUpdater] Launching silent NSIS installer with auto-restart: ${downloadedDirectInstaller}`);
      const appExe = process.execPath;
      const installerPath = downloadedDirectInstaller;

      if (process.platform === 'win32') {
        const tempBat = path.join(app.getPath('temp'), `krushi_erp_silent_update_${Date.now()}.bat`);
        const batContent = `@echo off
rem Wait for current ERP instance to close completely
timeout /t 2 /nobreak >nul
rem Execute silent NSIS upgrade (no wizard or manual steps needed)
start /wait "" "${installerPath}" /S
rem Small delay to allow desktop registration
timeout /t 1 /nobreak >nul
rem Automatically launch the newly upgraded application
start "" "${appExe}"
rem Delete temporary script
del "%~f0" >nul 2>&1
exit
`;
        fs.writeFileSync(tempBat, batContent, 'utf8');
        const child = spawn('cmd.exe', ['/c', tempBat], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.unref();
        setTimeout(() => {
          app.quit();
        }, 500);
        return;
      } else {
        const child = spawn(installerPath, ['/S'], { detached: true, stdio: 'ignore' });
        child.unref();
        setTimeout(() => {
          app.quit();
        }, 500);
        return;
      }
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

    // Also write a copy to the local project data/backups directory if available
    try {
      const projBackupDir = path.resolve(process.cwd(), 'data', 'backups');
      if (!fs.existsSync(projBackupDir)) {
        fs.mkdirSync(projBackupDir, { recursive: true });
      }
      fs.writeFileSync(path.join(projBackupDir, filename), content, 'utf8');
      console.log('[Electron] Backup also mirrored to project folder:', path.join(projBackupDir, filename));
    } catch {}

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
  const targetGasUrl = payload.gasUrl || 'https://script.google.com/macros/s/AKfycbyj6Rf81Y9TQE6JThFU0iWDz3LI4TzkA3ts4L_NQGm7ekCg0hSM8RNiA7yS00MGq9w/exec';
  try {
    const dataStr = JSON.stringify(payload);
    const cloudRes = await new Promise((resolve) => {
      try {
        const parsed = new URL(targetGasUrl);
        const options = {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
            'Content-Length': Buffer.byteLength(dataStr)
          },
          timeout: 25000
        };

        const req = https.request(options, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            https.get(res.headers.location, (redRes) => {
              let body = '';
              redRes.on('data', chunk => body += chunk);
              redRes.on('end', () => {
                const ok = redRes.statusCode >= 200 && redRes.statusCode < 400;
                resolve({ 
                  success: ok, 
                  status: redRes.statusCode, 
                  message: ok ? 'Successfully uploaded to Google Drive' : `Google redirect returned HTTP ${redRes.statusCode}` 
                });
              });
            }).on('error', (err) => resolve({ success: false, message: `Redirect error: ${err.message}` }));
            return;
          }
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            const ok = res.statusCode >= 200 && res.statusCode < 400;
            let errMsg = '';
            if (!ok) {
              if (res.statusCode === 404) {
                errMsg = 'Google Apps Script URL 404 (Script not found or access not set to Anyone)';
              } else {
                errMsg = `Google Server returned HTTP ${res.statusCode}`;
              }
            }
            resolve({ success: ok, status: res.statusCode, message: errMsg });
          });
        });

        req.on('error', (err) => resolve({ success: false, message: err.message }));
        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, message: 'Google Drive request timed out (25s)' });
        });
        req.write(dataStr);
        req.end();
      } catch (parseErr) {
        resolve({ success: false, message: `Invalid GAS URL: ${parseErr.message}` });
      }
    });

    result.cloudSaved = cloudRes.success;
    result.status = cloudRes.status;
    result.message = cloudRes.message || (cloudRes.success ? 'Google Drive Sync OK' : 'Google Drive Sync Failed');
  } catch (cloudErr) {
    result.cloudSaved = false;
    result.message = cloudErr.message;
  }

  return { success: result.localSaved || result.cloudSaved, ...result };
});

// ============================================
// Invoice Scanner Desktop Bridge: Check Quota & Parse
// ============================================
let desktopQuotaCache = {
  available: false,
  quotaExceeded: false,
  reason: '',
  timestamp: 0,
};

function tryLocalBackend(endpoint, method = 'GET', payload = null, timeoutMs = 2500) {
  return new Promise((resolve) => {
    try {
      const isPost = method === 'POST';
      const bodyData = payload ? JSON.stringify(payload) : null;
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3000,
        path: endpoint,
        method,
        headers: {
          'User-Agent': 'KrushiSevaERP-DesktopApp',
          ...(bodyData ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyData),
          } : {}),
        },
        timeout: timeoutMs,
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: json });
          } catch {
            resolve({ ok: false, status: res.statusCode, error: 'Non-JSON response' });
          }
        });
      });

      req.on('error', (err) => resolve({ ok: false, status: 0, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 408, error: 'Timeout' });
      });

      if (bodyData) req.write(bodyData);
      req.end();
    } catch (e) {
      resolve({ ok: false, status: 500, error: e.message });
    }
  });
}

function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  // Try reading from resources / app path / userData .env files in packaged Windows app
  try {
    const candidatePaths = [
      process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
      process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', '.env') : null,
      path.join(__dirname, '../.env'),
      path.join(__dirname, '.env'),
      typeof app !== 'undefined' && app.getAppPath ? path.join(app.getAppPath(), '.env') : null,
      typeof app !== 'undefined' && app.getPath ? path.join(app.getPath('userData'), '.env') : null
    ].filter(Boolean);

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const match = content.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/);
        if (match && match[1] && match[1].trim()) {
          process.env.GEMINI_API_KEY = match[1].trim();
          return match[1].trim();
        }
      }
    }
  } catch (e) {
    console.warn('[DesktopApp] getGeminiApiKey note:', e.message);
  }

  // Active production key configured for the ERP scanner
  const b64Key = 'QVEuQWI4Uk42TGEwaG13Rk56andGc3AySEJhd2FQOWV3eHRDc1B0aHppNTN0TWdhYzItY0E=';
  const defaultKey = Buffer.from(b64Key, 'base64').toString('utf8');
  process.env.GEMINI_API_KEY = defaultKey;
  return defaultKey;
}

function probeGeminiDirect(apiKey) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 1 }
    });

    const req = https.request(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'KrushiSevaERP-DesktopApp'
      },
      timeout: 8000
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        const isQuotaOrAuth = res.statusCode === 429 || res.statusCode === 403;
        resolve({
          available: res.statusCode >= 200 && res.statusCode < 300,
          quotaExceeded: isQuotaOrAuth,
          status: res.statusCode,
          reason: isQuotaOrAuth ? 'QUOTA_OR_AUTH_UNAVAILABLE' : undefined
        });
      });
    });

    req.on('error', (err) => {
      // In desktop app, do not block UI if network probe failed temporarily
      resolve({ available: true, quotaExceeded: false, status: 0, reason: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ available: true, quotaExceeded: false, status: 408, reason: 'Timeout' });
    });

    req.write(postData);
    req.end();
  });
}

function parseInvoiceDirectWithGemini(apiKey, fileBase64, mimeType) {
  return new Promise((resolve) => {
    let cleanBase64 = fileBase64;
    if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }
    cleanBase64 = cleanBase64.trim();

    const postData = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64
              }
            },
            {
              text: `You are an expert Indian GST tax invoice analyzer specializing in Krushi Seva Kendra / agricultural input store purchase bills, seed, pesticide, fertilizer dealer invoices.
Extract the following information in structured JSON:
{
  "supplierName": "Vendor or Supplier business name",
  "supplierGstin": "15-digit GSTIN if available",
  "supplierAddress": "Supplier address",
  "supplierPhone": "Supplier phone number",
  "supplierEmail": "Supplier email",
  "invoiceNumber": "Invoice / Bill Number",
  "invoiceDate": "YYYY-MM-DD",
  "items": [
    {
      "name": "Product description / name",
      "hsn": "HSN Code",
      "batchNumber": "Batch Number",
      "expiryDate": "YYYY-MM-DD",
      "quantity": 10,
      "unit": "PCS/BAG/LTR/KG",
      "rate": 100,
      "discount": 0,
      "gstRate": 18,
      "taxableAmount": 1000,
      "totalAmount": 1180
    }
  ],
  "subtotal": 1000,
  "taxAmount": 180,
  "grandTotal": 1180
}
Ensure all numeric fields are valid numbers. Return valid JSON only.`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const sendRequest = (modelName) => {
      const req = https.request(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'KrushiSevaERP-DesktopApp'
        },
        timeout: 45000
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          if (res.statusCode === 429 || res.statusCode === 403) {
            return resolve({ success: false, quotaExceeded: true, error: 'Quota or rate limit reached.' });
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const rootJson = JSON.parse(raw);
              const textContent = rootJson?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textContent) {
                const parsed = JSON.parse(textContent);
                return resolve({ success: true, data: parsed });
              }
            } catch (jsonErr) {
              return resolve({ success: false, error: 'Failed to parse invoice structure.' });
            }
          }
          if (modelName === 'gemini-3.5-flash-lite') {
            console.warn('[DesktopApp] Falling back to gemini-3.8-flash...');
            return sendRequest('gemini-3.8-flash');
          }
          resolve({ success: false, error: `Scanner error (${res.statusCode})` });
        });
      });

      req.on('error', (err) => {
        if (modelName === 'gemini-3.5-flash-lite') {
          return sendRequest('gemini-3.8-flash');
        }
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });

      req.write(postData);
      req.end();
    };

    sendRequest('gemini-3.5-flash-lite');
  });
}

ipcMain.handle('ai-check-quota', async () => {
  const now = Date.now();
  if (now - desktopQuotaCache.timestamp < 30000 && desktopQuotaCache.timestamp > 0) {
    return {
      available: desktopQuotaCache.available,
      quotaExceeded: desktopQuotaCache.quotaExceeded,
      reason: desktopQuotaCache.reason
    };
  }

  // 1. Try local Express backend if running
  const localRes = await tryLocalBackend('/api/ai/quota-status', 'GET', null, 1500);
  if (localRes.ok && localRes.data) {
    desktopQuotaCache = {
      available: Boolean(localRes.data.available),
      quotaExceeded: Boolean(localRes.data.quotaExceeded),
      reason: localRes.data.reason || '',
      timestamp: now
    };
    return desktopQuotaCache;
  }

  // 2. Direct probe via Google Gemini API if API key is present
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    const probe = await probeGeminiDirect(apiKey);
    desktopQuotaCache = {
      available: probe.available || !probe.quotaExceeded,
      quotaExceeded: probe.quotaExceeded,
      reason: probe.reason || '',
      timestamp: now
    };
    return desktopQuotaCache;
  }

  return {
    available: true,
    quotaExceeded: false,
    reason: ''
  };
});

ipcMain.handle('ai-parse-invoice', async (_event, payload) => {
  const { fileBase64, mimeType } = payload || {};
  if (!fileBase64 || !mimeType) {
    return { success: false, error: 'Missing file data or MIME type.' };
  }

  // 1. Try local Express backend if running
  const localRes = await tryLocalBackend('/api/ai/parse-invoice', 'POST', payload, 45000);
  if (localRes.ok && localRes.data) {
    return localRes.data;
  }

  // 2. Direct parse via Gemini API in desktop process
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    return await parseInvoiceDirectWithGemini(apiKey, fileBase64, mimeType);
  }

  return {
    success: false,
    error: 'Scanner service is not configured (missing GEMINI_API_KEY).'
  };
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
