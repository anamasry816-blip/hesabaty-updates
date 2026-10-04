const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const { NsisUpdater } = require('electron-updater');
const crypto = require('crypto');
const PUB = crypto.createPublicKey(`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAbByg52ywg1nMFO/f/7oZzO2uagROqjO7u6EiiWrxxHU=
-----END PUBLIC KEY-----`);

const dataFile = () => path.join(app.getPath('userData'), 'data.json');
const cfgFile = () => path.join(app.getPath('userData'), 'config.json');
let win, lastJson = null;
let updater = null;
let updaterUrl = "";
let updaterBusy = false;

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
function writeAtomic(f, text) {
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, f);
}
const cfg = () => readJson(cfgFile()) || {};
const bkDir = () => cfg().bkdir || path.join(app.getPath('documents'), 'Hesabaty-Backups');
const stamp = () => new Date().toISOString().slice(0, 10);

function autoBackup() {
  try {
    if (!fs.existsSync(dataFile())) return;
    const dir = bkDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(dataFile(), path.join(dir, `hesabaty-${stamp()}.json`));
    const files = fs.readdirSync(dir).filter(f => /^hesabaty-.*\.json$/.test(f)).sort();
    files.slice(0, Math.max(0, files.length - 30)).forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch (e) {} });
  } catch (e) {}
}

function flush() { if (lastJson !== null) { try { writeAtomic(dataFile(), lastJson); } catch (e) {} lastJson = null; } }

ipcMain.on('load', (e) => { e.returnValue = readJson(dataFile()); });
ipcMain.on('save', (e, d) => {
  try { writeAtomic(dataFile(), JSON.stringify(d)); } catch (err) {}
});

ipcMain.handle('backup', async () => {
  const r = await dialog.showSaveDialog(win, { defaultPath: `hesabaty-backup-${stamp()}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return false;
  fs.copyFileSync(dataFile(), r.filePath);
  return true;
});

ipcMain.handle('restore', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return false;
  const txt = fs.readFileSync(r.filePaths[0], 'utf8');
  try { JSON.parse(txt); } catch (e) { dialog.showErrorBox('خطأ', 'الملف المختار ليس نسخة صحيحة'); return false; }
  try { autoBackup(); const dir = bkDir(); fs.mkdirSync(dir, { recursive: true }); if (fs.existsSync(dataFile())) fs.copyFileSync(dataFile(), path.join(dir, `before-restore-${Date.now()}.json`)); } catch (e) {}
  writeAtomic(dataFile(), txt);
  win.webContents.reload();
  return true;
});

ipcMain.handle('bkdir', async (e, choose) => {
  if (choose) {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
    if (!r.canceled && r.filePaths[0]) { const c = cfg(); c.bkdir = r.filePaths[0]; writeAtomic(cfgFile(), JSON.stringify(c)); }
  }
  return bkDir();
});

ipcMain.handle('pdf', async (e, name) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: (name || 'report') .replace(/\.pdf$/i, '') + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled || !r.filePath) return false;
  const buf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  fs.writeFileSync(r.filePath, buf);
  shell.showItemInFolder(r.filePath);
  return true;
});

ipcMain.handle('saveFile', async (e, name, text) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name || 'export.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
  if (r.canceled || !r.filePath) return false;
  const t = String(text);
  fs.writeFileSync(r.filePath, t.charCodeAt(0) === 0xFEFF ? t : '\ufeff' + t, 'utf8');
  return true;
});

ipcMain.handle('open', (e, url) => {
  if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
});



function updateUrl() { return 'github://anamasry816-blip/hesabaty-updates'; }

function sendUpdateStatus(status, extra = {}) {
  if (win && !win.isDestroyed()) {
    try { win.webContents.send('update-status', { status, ...extra, version: app.getVersion() }); } catch (e) {}
  }
}

function setupUpdater() {
  if (process.env.NODE_ENV === 'development') return null;
  if (updater) return updater;
  try {
    // يقرأ إعداد GitHub من app-update.yml الذي ينشئه electron-builder أثناء البناء.
    updater = new NsisUpdater();
    updaterUrl = updateUrl();
    updater.autoDownload = true;
    // النسخة الحالية غير موقعة بشهادة Authenticode. نعتمد على بيانات التحديث/التحقق المتاحة.
    updater.verifyUpdateCodeSignature = false;
    updater.autoInstallOnAppQuit = true;
    updater.on('checking-for-update', () => sendUpdateStatus('checking'));
    updater.on('update-available', info => sendUpdateStatus('available', { latestVersion: info?.version || '' }));
    updater.on('update-not-available', info => sendUpdateStatus('none', { latestVersion: info?.version || '' }));
    updater.on('download-progress', p => sendUpdateStatus('downloading', { percent: Math.max(0, Math.min(100, Math.round(p?.percent || 0))) }));
    updater.on('update-downloaded', info => sendUpdateStatus('downloaded', { latestVersion: info?.version || '' }));
    updater.on('error', err => sendUpdateStatus('error', { message: String(err?.message || err || 'تعذر تشغيل نظام التحديث') }));
    return updater;
  } catch (err) {
    sendUpdateStatus('error', { message: String(err?.message || err || 'تعذر تشغيل نظام التحديث') });
    return null;
  }
}

ipcMain.handle('update-url', () => updateUrl());
ipcMain.handle('update-check', async () => {
  if (process.env.NODE_ENV === 'development') return { ok: false, code: 'dev', msg: 'التحديث متاح بعد التثبيت' };
  if (updaterBusy) return { ok: false, code: 'busy', msg: 'جارٍ البحث عن تحديث...' };
  try {
    if (!updater) setupUpdater();
    if (!updater) return { ok: false, code: 'disabled', msg: 'نظام التحديث غير متاح' };
    updaterBusy = true;
    const r = await updater.checkForUpdates();
    updaterBusy = false;
    return { ok: true, version: r?.updateInfo?.version || app.getVersion(), updateAvailable: !!r?.isUpdateAvailable, current: app.getVersion() };
  } catch (err) {
    updaterBusy = false;
    return { ok: false, code: 'error', msg: String(err?.message || err || 'تعذر الاتصال بتحديثات GitHub') };
  }
});
ipcMain.handle('update-install', () => {
  try {
    if (!updater) return { ok: false, msg: 'لا يوجد تحديث جاهز' };
    updater.quitAndInstall(false, true);
    return { ok: true };
  } catch (err) {
    return { ok: false, msg: String(err?.message || err || 'تعذر تثبيت التحديث') };
  }
});

ipcMain.handle('printers', async () => (await win.webContents.getPrintersAsync()).map(p => p.name));
ipcMain.handle('prnCfg', () => { const c = cfg(); return { printer: c.printer || '', silent: !!c.silent, share: c.share || '' }; });
ipcMain.handle('prnSave', (e, o) => { const c = cfg(); Object.assign(c, { printer: o.printer, silent: !!o.silent, share: o.share }); writeAtomic(cfgFile(), JSON.stringify(c)); return true; });
ipcMain.handle('print', async (e, direct = false) => {
  const c = cfg();
  let deviceName = c.printer || undefined;
  if (direct && !deviceName) {
    try {
      const ps = await win.webContents.getPrintersAsync();
      const def = ps.find(p => p.isDefault);
      if (def) deviceName = def.name;
    } catch (err) {}
  }
  return await new Promise(res => {
    win.webContents.print({
      silent: !!(direct && deviceName) || !!(c.silent && deviceName),
      deviceName,
      printBackground: true
    }, ok => {
      if (ok && c.share && process.platform === 'win32') {
        const f = path.join(app.getPath('temp'), 'kick.bin');
        fs.writeFileSync(f, Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
        exec('copy /b "' + f + '" "' + '\\\\localhost\\' + c.share + '"');
      }
      res(ok);
    });
  });
});


function machineId() {
  let g = '';
  try { g = execSync('reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { encoding: 'utf8' }).trim().split(/\s+/).pop(); } catch (e) { g = require('os').hostname(); }
  return crypto.createHash('sha256').update('hesabaty|' + g).digest('hex').slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, '$1-');
}
function verify(key) {
  try {
    const [p, sg] = String(key).trim().split('.');
    if (!p || !sg) return null;
    if (!crypto.verify(null, Buffer.from(p), PUB, Buffer.from(sg, 'base64url'))) return null;
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (d.m !== machineId()) return null;
    if (d.s && Date.now() < d.s) d.notStarted = true;
    if (d.e && Date.now() > d.e) d.expired = true;
    return d;
  } catch (e) { return null; }
}
function licStatus() {
  const c = cfg();
  if (c.lic) { const d = verify(c.lic); if (d && !d.expired && !d.notStarted) return { mode: 'licensed', name: d.n, exp: d.e || 0, machine: machineId() }; }
  if (!c.first) { c.first = Date.now(); writeAtomic(cfgFile(), JSON.stringify(c)); }
  const left = Math.max(0, 14 - Math.floor((Date.now() - c.first) / 864e5));
  return { mode: 'trial', left, expired: left <= 0, machine: machineId() };
}
ipcMain.on('info', e => { e.returnValue = { version: app.getVersion(), lic: licStatus() }; });
ipcMain.on('licMachine', e => { e.returnValue = machineId(); });
ipcMain.handle('licActivate', (e, key) => {
  const raw = String(key).trim();
  const d = verify(raw);
  if (!d) return { ok: false, msg: 'الكود غير صحيح أو مخصص لجهاز آخر' };
  if (d.notStarted) return { ok: false, msg: 'هذا الكود لم يبدأ موعد تفعيله بعد' };
  if (d.expired) return { ok: false, msg: 'هذا الكود منتهي' };
  const c = cfg(); c.lic = raw; writeAtomic(cfgFile(), JSON.stringify(c));
  win.loadFile(path.join(__dirname, 'index.html'));
  return { ok: true };
});

function createWindow(blocked) {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600, show: false, title: 'حساباتي', icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); if (!blocked) firstRun(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.loadFile(path.join(__dirname, blocked ? 'license.html' : 'index.html'));
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    autoBackup();
    createWindow(licStatus().expired);
    setInterval(autoBackup, 60 * 60 * 1000);
    setTimeout(() => {
      {
        setupUpdater();
        try { updater?.checkForUpdates(); } catch (e) {}
      }
    }, 12000);
    setInterval(() => {
      if (!updaterBusy) { try { const u = setupUpdater(); u?.checkForUpdates(); } catch (e) {} }
    }, 6 * 60 * 60 * 1000);
  });
  app.on('before-quit', autoBackup);
  app.on('window-all-closed', () => app.quit());
}
