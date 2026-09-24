import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { googleDriveBackupService } from './server/backupService';

// Load environment variables
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Support JSON & raw binary body for SQLite database syncing
app.use(express.json({ limit: '100mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));

// ==========================================
// Google Drive Automatic Backup API Endpoints
// ==========================================

// 1. Get minimal public backup status (NEVER exposes secrets or private keys)
app.get('/api/backup/status', (_req, res) => {
  try {
    const summary = googleDriveBackupService.getStatusSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get recent backup logs
app.get('/api/backup/logs', (_req, res) => {
  try {
    const logs = googleDriveBackupService.readLogs().slice(0, 20);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Trigger immediate backup cycle (non-blocking)
app.post('/api/backup/run', async (_req, res) => {
  try {
    // Run asynchronously so HTTP request doesn't timeout
    googleDriveBackupService.runBackupCycle(0).catch((err) => {
      console.error('[GoogleDriveBackup] Manual trigger error:', err.message);
    });
    res.json({ message: 'Backup cycle initiated', started_at: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Trigger shutdown backup when system/browser is closing
app.post('/api/backup/shutdown', async (_req, res) => {
  try {
    console.log('[Server] Shutdown backup request received from client.');
    if (googleDriveBackupService.isConfigured()) {
      googleDriveBackupService.runBackupCycle(0).catch((err) => {
        console.warn('[Server] Client shutdown backup error:', err.message);
      });
    }
    res.json({ message: 'Shutdown backup triggered' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update and persist Google Service Account credentials directly into .env
app.post('/api/backup/config', (req, res) => {
  try {
    let email = '';
    let privateKey = '';
    let folderId = '';

    // Case 1: User pasted raw JSON file content from Google Cloud Console
    if (req.body.raw_json && typeof req.body.raw_json === 'string') {
      try {
        const parsed = JSON.parse(req.body.raw_json);
        email = parsed.client_email || '';
        privateKey = parsed.private_key || '';
      } catch {
        return res.status(400).json({ error: 'Invalid JSON credentials format' });
      }
    } else {
      // Case 2: User provided separate fields
      email = req.body.email || req.body.service_account_email || '';
      privateKey = req.body.private_key || req.body.service_account_private_key || '';
    }

    if (req.body.apps_script_url) {
      const gasUrl = String(req.body.apps_script_url).trim();
      process.env.GOOGLE_APPS_SCRIPT_URL = gasUrl;
    }

    if (req.body.folder_id) {
      folderId = String(req.body.folder_id).trim();
    }

    // If only apps_script_url is provided
    if (req.body.apps_script_url && (!email || !privateKey)) {
      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = '';
      if (require('fs').existsSync(envPath)) {
        envContent = require('fs').readFileSync(envPath, 'utf8');
      }
      const updates: Record<string, string> = {
        GOOGLE_APPS_SCRIPT_URL: req.body.apps_script_url.trim(),
        BACKUP_ENABLED: 'true',
      };
      if (folderId) updates.GOOGLE_DRIVE_FOLDER_ID = folderId;

      for (const [k, v] of Object.entries(updates)) {
        const regex = new RegExp(`^${k}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${k}=${v}`);
        } else {
          envContent += `\n${k}=${v}`;
        }
      }
      require('fs').writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
      googleDriveBackupService.runBackupCycle(0).catch(() => {});
      return res.json({
        success: true,
        message: 'Google Apps Script URL saved and backup initiated!',
        status: googleDriveBackupService.getStatusSummary(),
      });
    }

    if (!email || !privateKey) {
      return res.status(400).json({ error: 'Missing email or private key in payload' });
    }

    // Format newlines if pasted as literal \n
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    // Update in-memory runtime
    googleDriveBackupService.updateCredentials(email, formattedPrivateKey, folderId);

    // Persist to .env file
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';
    if (require('fs').existsSync(envPath)) {
      envContent = require('fs').readFileSync(envPath, 'utf8');
    }

    const updates: Record<string, string> = {
      GOOGLE_SERVICE_ACCOUNT_EMAIL: email,
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: `"${formattedPrivateKey.replace(/\n/g, '\\n')}"`,
      BACKUP_ENABLED: 'true',
    };
    if (folderId) {
      updates.GOOGLE_DRIVE_FOLDER_ID = folderId;
    }

    for (const [k, v] of Object.entries(updates)) {
      const regex = new RegExp(`^${k}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${k}=${v}`);
      } else {
        envContent += `\n${k}=${v}`;
      }
    }

    require('fs').writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    console.log('[Server] Saved updated Google Service Account credentials to .env');

    // Trigger test backup cycle
    googleDriveBackupService.runBackupCycle(0).catch((err) => {
      console.warn('[Server] Immediate post-config backup check error:', err.message);
    });

    res.json({
      success: true,
      message: 'Google Service Account credentials updated successfully. Test backup cycle initiated.',
      status: googleDriveBackupService.getStatusSummary(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Sync client SQLite database binary to backend disk
app.post('/api/backup/sync-db', (req, res) => {
  try {
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      googleDriveBackupService.saveDatabaseBytes(req.body);
      return res.json({ success: true, bytes: req.body.length });
    }
    
    // Check if base64 sent in JSON
    if (req.body && typeof req.body.base64 === 'string') {
      const buf = Buffer.from(req.body.base64, 'base64');
      googleDriveBackupService.saveDatabaseBytes(buf);
      return res.json({ success: true, bytes: buf.length });
    }

    res.status(400).json({ error: 'Missing or empty binary database payload' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Frontend Serving & Vite Integration
// ==========================================

async function startServer() {
  // Initialize the automatic background backup scheduler
  await googleDriveBackupService.init();

  if (!isProd) {
    // Dev mode: Mount Vite dev server middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted for development.');
  } else {
    // Production mode: Serve built static files from dist
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[Server] Serving production static assets from dist.');
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Krushi Seva ERP server running on http://localhost:${port}`);
  });
}

// Graceful shutdown: Execute backup before server exits
let isShuttingDown = false;
async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Server] Received ${signal}. Executing system shutdown backup...`);
  try {
    if (googleDriveBackupService.isConfigured()) {
      await googleDriveBackupService.runBackupCycle(0);
      console.log('[Server] System shutdown backup completed successfully.');
    }
  } catch (err: any) {
    console.warn('[Server] System shutdown backup notice:', err.message);
  }
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

startServer().catch((err) => {
  console.error('[Server] Fatal error starting server:', err);
  process.exit(1);
});
