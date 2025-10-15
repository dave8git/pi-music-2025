const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    windowControl: (action) => ipcRenderer.send('window-control', action),
    onMusicEvents: (callback) => {
        ipcRenderer.on('music-events', (event, updates) => {
            callback(updates);
        })
    },
    loadMusic: (fileUrl) => ipcRenderer.invoke('load-audio', fileUrl),
    onSongsUpdated: (callback) => ipcRenderer.on('songs-updated', (event, fileName) => callback(fileName)),
    loadAllFiles: () => ipcRenderer.invoke('load-all-files'),
    loadAudio: (fileUrl) => ipcRenderer.invoke('load-audio', fileUrl),
    uploadMp3Files: () => ipcRenderer.invoke('upload-mp3-files'),
    
    // Artists window methods
    openArtistsWindow: () => ipcRenderer.send('open-artists-window'),
    closeArtistsWindow: () => ipcRenderer.send('close-artists-window'),
    getArtists: () => ipcRenderer.send('get-artists'), // ✅ Fixed - just send the signal
    sendArtistsToPopup: (artists) => ipcRenderer.send('send-artists-to-popup', artists), // ✅ This sends the actual artists
    selectArtist: (artist) => ipcRenderer.send('artist-selected', artist),

    // Listeners
    onRequestArtists: (callback) => {
        ipcRenderer.on('request-artists-for-popup', () => callback());
    },
    onReceiveArtists: (callback) => {
        ipcRenderer.on('receive-artists', (event, artists) => callback(artists));
    },
    onArtistSelected: (callback) => {
        ipcRenderer.on('artist-selected', (event, artist) => callback(artist));
    }
});

// send - komunikacja jednokierunkowa od siebie do procesu main (tyle!). Można wysłać zdarzenie etc.
// np. zamknij okno, zapisz plik - nie rób nic więcej
// invoke - wysyłam i oczekuję odpowiedzi (odpowiedź można obsłużyć handle) - zwraca do procesu w drugą stronę - czyli renderer
// on - zwykłe nasłuchiwanie na zdarzenia, które przychodzą z maina

