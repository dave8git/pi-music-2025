const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    windowControl: (action) => ipcRenderer.send('window-control', action), // jednokierunkowa komunikacja z akcją
    onMusicEvents: (callback) => {
        ipcRenderer.on('music-events', (event, updates) => {
            callback(updates); // renderer gets an array of {type, path}
        })
    },
    loadMusic: (fileUrl) => ipcRenderer.invoke('load-audio', fileUrl), // 
    onSongsUpdated: (callback) => ipcRenderer.on('songs-updated', (event, fileName) => callback(fileName)),
    loadAllFiles: () => ipcRenderer.invoke('load-all-files'),
    loadAudio: (fileUrl) => ipcRenderer.invoke('load-audio', fileUrl),
    uploadMp3Files: () => ipcRenderer.invoke('upload-mp3-files'),
});

// send - komunikacja jednokierunkowa od siebie do procesu main (tyle!). Można wysłać zdarzenie etc.
// np. zamknij okno, zapisz plik - nie rób nic więcej
// invoke - wysyłam i oczekuję odpowiedzi (odpowiedź można obsłużyć handle) - zwraca do procesu w drugą stronę - czyli renderer
// on - zwykłe nasłuchiwanie na zdarzenia, które przychodzą z maina

