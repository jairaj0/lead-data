const { contextBridge, ipcRenderer } = require('electron');

// The renderer (index.html) can only see these safe methods.
contextBridge.exposeInMainWorld('leadAPI', {
  request: (args) => ipcRenderer.invoke('api', args),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  // WhatsApp check
  waStart: () => ipcRenderer.invoke('wa-start'),
  waStatus: () => ipcRenderer.invoke('wa-status'),
  waLogout: () => ipcRenderer.invoke('wa-logout'),
  waCheck: (numberIntl) => ipcRenderer.invoke('wa-check', { numberIntl }),
  onWaStatus: (cb) => ipcRenderer.on('wa-status', (_e, status) => cb(status)),
});
