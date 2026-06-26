const { app, BrowserWindow, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const createStore = require('./leadstore');
const createWhatsApp = require('./whatsapp');

// ---- data folder (saare JSON yahin) ----
// EK HI folder — dev ho ya packaged app, dono yahin se padhte-likhte hain.
// Isse data kabhi "reset" nahi dikhega (pehle dev project/data use karta tha,
// installed app userData — do alag jagah, isliye confusion hoti thi).
// ~/Library/Application Support/lead-data/data  (writable, app update pe bhi bacha rehta hai)
const DATA_DIR = path.join(app.getPath('userData'), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Seed: pehli baar (folder khaali ho to) bundled sample JSON copy kar do.
// Maujooda file ko kabhi overwrite nahi karta — tumhare edits safe.
const seedDir = app.isPackaged ? path.join(process.resourcesPath, 'data') : path.join(__dirname, 'data');
if (fs.existsSync(seedDir)) {
  for (const f of fs.readdirSync(seedDir)) {
    if (!f.toLowerCase().endsWith('.json')) continue;
    const dest = path.join(DATA_DIR, f);
    if (!fs.existsSync(dest)) fs.copyFileSync(path.join(seedDir, f), dest);
  }
}

const store = createStore(DATA_DIR);

// ---- IPC: renderer ke api() calls yahan handle hote hain ----
ipcMain.handle('api', async (_e, { method, path: p, file, body }) => {
  if (p === '/api/files' && method === 'GET') return { files: store.listFiles() };
  if (p === '/api/import' && method === 'POST') return store.importJSON(body.name, body.data);
  if (p === '/api/leads' && method === 'GET') {
    const leads = store.readLeads(file);
    if (leads === null) throw new Error('file not found');
    return { file, statuses: store.STATUSES, leads };
  }
  if (p === '/api/leads' && method === 'POST') return { lead: store.addLead(file, body) };
  const m = p.match(/^\/api\/leads\/(.+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (method === 'PUT' || method === 'PATCH') return { lead: store.updateLead(file, id, body) };
    if (method === 'DELETE') return { deleted: store.deleteLead(file, id) };
  }
  throw new Error('unknown endpoint: ' + method + ' ' + p);
});

ipcMain.handle('open-data-folder', async () => {
  await shell.openPath(store.dir);
  return store.dir;
});

// ---- WhatsApp check (whatsapp-web.js) ----
let mainWin = null;
const wa = createWhatsApp({
  dataPath: path.join(app.getPath('userData'), 'wa-session'),
  emit: (status) => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('wa-status', status); },
});
ipcMain.handle('wa-start', async () => wa.start());
ipcMain.handle('wa-status', async () => wa.getStatus());
ipcMain.handle('wa-logout', async () => wa.logout());
ipcMain.handle('wa-check', async (_e, { numberIntl }) => wa.check(numberIntl));
app.on('before-quit', () => { try { wa.destroy(); } catch (_) {} });

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 500,
    title: 'Lead Data',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'public', 'index.html'));
  mainWin = win;
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(__dirname, 'build', 'icon.png');
    if (fs.existsSync(iconPath)) {
      try { app.dock.setIcon(nativeImage.createFromPath(iconPath)); } catch (_) {}
    }
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
