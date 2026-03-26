const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Communication functions between the Online UI and Electron's Local Logic
  fetchLocalStatus: () => ipcRenderer.invoke('get-status'),
  reprintOrder: (id) => ipcRenderer.send('reprint-order', id)
});
