const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('halo', {
  communications: (action, ...args) => { if (!['list','import','account','create','approve','action','suppress','refresh'].includes(action)) return Promise.reject(new Error('Invalid action')); return ipcRenderer.invoke(`communications:${action}`, ...args); },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (p) => ipcRenderer.invoke('settings:set', p),
  run: (history) => ipcRenderer.invoke('agent:run', history),
  confirm: (id, ok) => ipcRenderer.invoke('confirm:reply', id, ok),
  hide: () => ipcRenderer.invoke('win:minimize'),
  compact: (c) => ipcRenderer.invoke('win:compact', c),
  onEvent: (cb) => ipcRenderer.on('agent:event', (_e, d) => cb(d)),
});
