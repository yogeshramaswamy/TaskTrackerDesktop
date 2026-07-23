const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');

// --- Data directory: per-user, writable, survives app updates ------------
// The server (server/db/database.js) reads this to decide where tasks.db and
// backups live. Must be set BEFORE the server module is required.
const userDataDir = app.getPath('userData');
process.env.TASKTRACKER_DATA_DIR = userDataDir;

// Load .env sitting next to the app (dev) if present. In a packaged build the
// user configures AWS/Anthropic via the in-app Settings, so this is optional.
try {
  require('dotenv').config({ path: path.join(app.getAppPath(), '.env') });
} catch (_) { /* dotenv optional */ }

const PORT = process.env.PORT || 3001;
const isDev = !app.isPackaged;

let mainWindow = null;
let serverStarted = false;

// Check whether a TaskTracker server is already answering on the port. If one
// is (e.g. a leftover process), we reuse it instead of starting a second one
// and crashing with EADDRINUSE.
function isServerUp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

// Expose a native "choose a .db file" dialog to the server routes. The server
// runs in this same process, so it can call global.pickDbFile() directly.
global.pickDbFile = async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a TaskTracker database file to import',
    properties: ['openFile'],
    filters: [{ name: 'TaskTracker Database', extensions: ['db', 'sqlite'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
};

// Native "save a copy of my database" dialog. Returns the chosen path (or null
// if the user cancelled). defaultName is a suggested filename.
global.pickSaveDbPath = async (defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export TaskTracker database',
    defaultPath: defaultName || 'tasktracker-backup.db',
    filters: [{ name: 'TaskTracker Database', extensions: ['db'] }],
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
};

// Start the Express server in-process (same Node runtime as Electron main).
function startServer() {
  if (serverStarted) return;
  serverStarted = true;
  // Requiring the server boots it (it calls app.listen internally).
  require(path.join(app.getAppPath(), 'server', 'index.js'));
}

// Poll the server until it answers, then load the UI.
function waitForServer(url, onReady, attempt = 0) {
  http
    .get(url, (res) => {
      res.resume();
      onReady();
    })
    .on('error', () => {
      if (attempt > 100) {
        dialog.showErrorBox('TaskTracker', 'The local server did not start in time.');
        return;
      }
      setTimeout(() => waitForServer(url, onReady, attempt + 1), 150);
    });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    title: 'TaskTracker',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links (ticket URLs etc.) in the real browser, not the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const appUrl = `http://localhost:${PORT}/`;
  waitForServer(appUrl, () => {
    mainWindow.loadURL(appUrl);
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Single-instance lock: focus the existing window instead of opening a second.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const appUrl = `http://localhost:${PORT}/`;
    // Reuse an already-running server; otherwise start our own.
    if (!(await isServerUp(appUrl))) {
      startServer();
    }
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// Turn a would-be raw crash dialog into a readable message.
process.on('uncaughtException', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    dialog.showErrorBox(
      'TaskTracker already running',
      `Port ${PORT} is already in use — TaskTracker may already be open. ` +
      `Close the other window (or the stray process using the port) and try again.`
    );
  } else {
    dialog.showErrorBox('TaskTracker error', String((err && err.stack) || err));
  }
  app.quit();
});

app.on('window-all-closed', () => {
  // On macOS apps typically stay open; on Windows/Linux quit fully.
  if (process.platform !== 'darwin') app.quit();
});
