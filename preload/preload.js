const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    windowControl: (action) => ipcRenderer.send('window-control', action),
    onMusicEvents: (callback) => {
        ipcRenderer.on('music-events', (event, updates) => {
            callback(updates); // renderer gets an array of {type, path}
        })
    }
});