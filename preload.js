const { contextBridge, ipcRenderer } = require('electron');
const crypto = require('crypto');
contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.sendSync('load'),
  save: (d) => ipcRenderer.send('save', d),
  hash: (s) => crypto.createHash('sha256').update(String(s)).digest('hex'),
  backup: () => ipcRenderer.invoke('backup'),
  restore: () => ipcRenderer.invoke('restore'),
  bkdir: (choose) => ipcRenderer.invoke('bkdir', !!choose),
  pdf: (name) => ipcRenderer.invoke('pdf', name),
  saveFile: (name, text) => ipcRenderer.invoke('saveFile', name, text),
  printers: () => ipcRenderer.invoke('printers'),
  prnCfg: () => ipcRenderer.invoke('prnCfg'),
  prnSave: (o) => ipcRenderer.invoke('prnSave', o),
  print: (direct = false) => ipcRenderer.invoke('print', !!direct),
  info: () => ipcRenderer.sendSync('info'),
  licMachine: () => ipcRenderer.sendSync('licMachine'),
  licActivate: (k) => ipcRenderer.invoke('licActivate', k),
  open: (url) => ipcRenderer.invoke('open', url),
  updateUrl: () => ipcRenderer.invoke('update-url'),
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  onUpdateStatus: (fn) => { const h = (_, d) => fn(d); ipcRenderer.on('update-status', h); return () => ipcRenderer.removeListener('update-status', h); }
});
