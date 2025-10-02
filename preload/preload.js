const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    windowControl: (action) => ipcRenderer.send('window-control', action)
});