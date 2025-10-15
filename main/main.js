const { getFs, getFsPromises, getPath, getOs, getElectron, getChokidar, getMusicMetadata, getUrl } = require("./modules");
let watcher = null;
const metadataCache = new Map();
// Poniższe gettery to trochę overkill, bo takie rzeczy jak electron, browserWindow będę potrzebne praktycznie od razu (a tutaj przez gettery są opóźnione), ale aby sie nauczyć zrobie to tak :)
function getApp() {
    const electron = getElectron();
    return electron?.app || null;
}

function getBrowserWindow() {
    const electron = getElectron();
    return electron?.BrowserWindow || null;
}

function getIpcMain() {
    const electron = getElectron();
    return electron?.ipcMain || null;
}

function getDialog() {
    const electron = getElectron();
    return electron?.dialog || null;
}

function getFileURLToPath() {
    const url = getUrl();
    return url?.fileURLToPath || null;
}

let mainWindow;
let selectedFolder = null;

function createWindow() {
    const BrowserWindow = getBrowserWindow();
    const path = getPath();

    if (!BrowserWindow || !path) return;

    const parentPathPreload = path.dirname(__dirname);
    const preloadPath = path.join(parentPathPreload, 'preload', 'preload.js');

    mainWindow = new BrowserWindow({
        width: 480,
        height: 300,
        frame: false,
        transparent: true, // window background transparent
        resizable: false,
        backgroundColor: '#00000000', // fully transparent
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false, // not exposing Node in renderer
            enableRemoteModule: false
        }
    });
    mainWindow.webContents.openDevTools();
    const parentPathRenderer = path.dirname(__dirname); // parentPath will be parent of /main directory so, root directory. 
    mainWindow.loadFile(path.join(parentPathRenderer, 'renderer', 'index.html'));
}

let artistsWindow = null;

function createArtistsWindow() {
    const BrowserWindow = getBrowserWindow();
    const path = getPath();

    if(!BrowserWindow || !path) return;

    if(artistsWindow && !artistsWindow.isDestroyed()) {
        artistsWindow.focus();
        return;
    }

    const parentPathPreload = path.dirname(__dirname);
    const preloadPath = path.join(parentPathPreload, 'preload', 'preload.js');
    const parentPathRenderer = path.dirname(__dirname);

    artistsWindow = new BrowserWindow({
        width: 480,
        height: 400,
        frame: false,
        transparent: true,
        resizable: false,
        backgroundColor: '#00000000',
        parent: mainWindow,
        modal: false,
        webPreferences: {
            preload: preloadPath, // ✅ Added preload script
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
        }
    });

    artistsWindow.webContents.openDevTools(); // Optional: for debugging
    artistsWindow.loadFile(path.join(parentPathRenderer, 'renderer', 'authors.html'));
    artistsWindow.on('closed', () => {
        artistsWindow = null;
    });
}

function setupArtistsWindowIPC() {
    const ipcMain = getIpcMain();
    if(!ipcMain) return;

    ipcMain.on('open-artists-window', () => {
        createArtistsWindow();
    });

    ipcMain.on('close-artists-window', () => {
        if (artistsWindow && !artistsWindow.isDestroyed()) {
            artistsWindow.close();
        }
    });
    ipcMain.on('get-artists', (event) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('request-artists-for-popup');
        }
    });

    ipcMain.on('send-artists-to-popup', (event, artists) => {
        if (artistsWindow && !artistsWindow.isDestroyed()) 
            artistsWindow.webContents.send('receive-artists', artists);
    });

    ipcMain.on('artist-selected', (event, artist) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('artist-selected', artist);
        }
        if (artistsWindow && !artistsWindow.isDestroyed()) {
            artistsWindow.close();
        }
    });
}

function isRaspberryPi() {
    const os = getOs();
    const fs = getFs();

    if (!os) {
        console.error('Required modules missing!');
        return null;
    }

    const platform = os.platform();
    const arch = os.arch();

    if (platform === 'linux' && (arch === 'arm' || arch === 'arm64')) {
        try {
            const cpuInfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
            return cpuInfo.includes('Raspberry PI') || cpuInfo.includes('BCM');
        } catch (err) {
            return true;
        }
    }
    return false;
}

function setupWindowControlIPC() {
    const ipcMain = getIpcMain();
    if (!ipcMain) return;
    ipcMain.on('window-control', (event, action) => { // function to control window clozing, mazimizeing and minimizing
        switch (action) {
            case 'minimize':
                mainWindow.minimize(); // calling on mainWindow, method sent from the renderer with appropriate action
                break;
            case 'maximize':
                if (mainWindow.isMaximized()) {
                    mainWindow.unmaximize();
                } else {
                    mainWindow.maximize();
                }
                break;
            case 'close':
                mainWindow.close();
                break;
        }
    })
}



// const os = loadModuleIfExist("os");

async function musicFilesExists(directoryPath) { // async - tworzy obietnice, i każda kolejna obietnica zwraca obietnice  - aby zwrócić wartość, obietnica musi być rozwiązana (wywołanie funkcji)
    const fsPromise = getFsPromises();
    if (!fsPromise) return false;
    try {
        const directoryFiles = await fsPromise.readdir(directoryPath);
        const mp3files = directoryFiles.filter(file => file.toLowerCase().endsWith(".mp3"));
        return mp3files.length > 0; // jeżeli są pliki - zwraca obietnice która zwróci true albo false // funkcje asynchroniczne zawsze zwaracają obietnice
    } catch {
        return false;
    }
}

async function musicLocation() {
    const fs = getFs();
    const path = getPath();
    const os = getOs();
    const dialog = getDialog();

    if (!fs || !path || !os || !dialog) {
        console.error('Required modules missing!');
        return null;
    }

    const homeDir = os.homedir();
    const homePath = path.join(homeDir, 'Downloads', 'music_folder');

    try {
        if (fs.existsSync(homePath) && fs.lstatSync(homePath).isDirectory()) {
            if (await musicFilesExists(homePath)) { // await rozwiązuje obietnicę
                selectedFolder = homePath;
            }
        } else {
            const result = await dialog.showOpenDialog(mainWindow, { // otwiera okno i pozwala wybrać katalog
                properties: ['openDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
                const chosenPath = result.filePaths[0];
                if (await musicFilesExists(chosenPath)) {
                    selectedFolder = chosenPath;
                } else {
                    const newFolderName = path.join(chosenPath, 'music_folder');
                    fs.mkdirSync(newFolderName, { recursive: true });
                    selectedFolder = chosenPath;
                }
            }
        }
    } catch (err) {
        console.log('Error selecting music folder:', err);
    }
    return selectedFolder;
}

const isWindows = getOs()?.platform() === 'win32';
const isRPi = isRaspberryPi();

let debounceTimer = null;
let pendingEvents = [];

function triggerUpdate(type, filePath) {
    pendingEvents.push({ type, path: filePath });

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            console.log('Sending event to renderer:', pendingEvents);
            mainWindow.webContents.send('music-events', pendingEvents);
        }
        pendingEvents = [];
    }, 300);
}

function startWatching(folderPath, isRPi) {
    const chokidar = getChokidar();

    if (!chokidar) {
        console.error('Required modules missing!');
        return null;
    }

    if (watcher) {
        console.log('Closing previous watcher...');
        watcher.close();
        watcher = null;
    }

    const options = {
        persistent: true,
        ignoreInitial: true,
        ignored: /(^|[\/\\])\../,
        depth: 0,
    }

    watcher = getChokidar().watch(folderPath, options);

    if (isRPi) {
        options.usePolling = true;
        options.interval = 2000;
        options.binaryInterval = 5000;
    } else {
        options.usePolling = false;
    }

    watcher
        .on('add', path => triggerUpdate('add', path))
        .on('change', path => triggerUpdate('change', path))
        .on('unlink', path => triggerUpdate('unlink', path));

    return watcher;
}

async function readMetadata(filePath, retries = 3, delay = 200) {
    const path = require('path');
    const fileName = path.basename(filePath);

    if (metadataCache.has(fileName)) {
        return metadataCache.get(fileName) // jeżeli metadane z tego pliku sa juz w cache'u to pobierze metadate z cache'u
    }

    const musicMetadata = getMusicMetadata()

    for (let i = 0; i < retries; i++) {
        try {
            const metadata = await musicMetadata.parseFile(filePath);
            metadataCache.set(fileName, metadata);
            return metadata;
        } catch (err) {
            if (err.code === 'EBUSY' || err.code === 'ENOENT') {
                await new Promise(res => setTimeout(res, delay)); // jezeli trwaja operacje dyskowe przedłuż o delay podany w parametrze
            } else {
                throw err;
            }
        }
    }
    throw new Error(`Failed to parse file after ${retries} retries: ${filePath}`);
}


let MUSIC_FOLDER;


const audioCache = new Map();
const MAX_AUDIO_CACHE_SIZE = 5;

function setupFileHandlers() {
    const ipcMain = getIpcMain();
    if (!ipcMain) return;

    ipcMain.handle('upload-mp3-files', async () => {
        const dialog = getDialog();
        const fs = getFs();
        const path = getPath();

        if(!mainWindow) return []; // musimy sprawdzić czy mainWindow istnieje, jeżeli nie to nie pokaże też dialogu

        const result = await dialog.showOpenDialog(mainWindow, { // result będzie obiektem i będzie miało dwie właściwości: canceled oraz filePaths.
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'MP3 Files', extensions: ['mp3']}],
        });

        if (result.canceled) return [];
        const uploadedFiles = [];

        const batchSize = 5;
        for (let i = 0; i < result.filePaths.length; i += batchSize) {
            const batch = result.filePaths.slice(i, i + batchSize);

            for(const filePath of batch) {
                try {
                    const fileName = path.basename(filePath);
                    const destinationPath = path.join(MUSIC_FOLDER, fileName);

                    if(fs.existsSync(destinationPath)) {
                        console.log(`File ${fileName} already exists, skipping`);
                        continue;
                    }

                    await fs.promises.copyFile(filePath, destinationPath);
                    console.log(`Uploaded: ${fileName}`);
                    uploadedFiles.push(fileName);
                    metadataCache.delete(fileName);
                } catch (err) {
                    console.error(`Error uploading ${filePath}:`, err);
                }
            }

            if(i + batchSize < result.filePaths.length) { // wstawia niewielkie przerwy pomiedzy batchami
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        return uploadedFiles;
    })

    ipcMain.handle('load-all-files', async () => {
        const fs = getFs();
        const path = getPath();
        const { pathToFileURL } = require('url');
        try {
            const files = await fs.promises.readdir(MUSIC_FOLDER);
            const mp3Files = files.filter(file => file.toLowerCase().endsWith('.mp3'));
            const metadataArray = [];
            const { pathToFileURL } = require('url');

            const batchSize = 10;
            for (let i = 0; i < mp3Files.length; i += batchSize) {
                const batch = mp3Files.slice(i, i + batchSize);

                await Promise.all(batch.map(async (fileName) => {
                    const filePath = path.join(MUSIC_FOLDER, fileName);
                    try {
                        const metadata = await readMetadata(filePath);
                        metadataArray.push({
                            filePath: pathToFileURL(filePath).toString(),
                            fileName,
                            title: metadata.common.title || path.basename(fileName, '.mp3'),
                            artist: metadata.common.artist || 'Uknown Artist',
                            album: metadata.common.album || 'Unknown Album',
                            year: metadata.common.year || '',
                            duration: metadata.format.duration || 0,
                        });
                    } catch (err) {
                        console.error(`Error reading metadata for $(fileName):`, err);
                        metadataArray.push({
                            filePath: pathToFileURL(filePath).toString(),
                            fileName,
                            title: path.basename(fileName, '.mp3'),
                            artist: 'Unknown Artist',
                            album: 'Uknown Album',
                            year: '',
                            duration: 0
                        });
                    }
                }));
                if (i + batchSize < mp3Files.length) {
                    await new Promise(resolve => setTimeout(resolve, 5));
                }
            }
            return metadataArray;
        } catch (err) {
            console.error('Error reading music folder:', err);
            return [];
        }
    });

    ipcMain.handle('load-audio', async (_, fileUrl) => {
        const fs = getFs();
        const path = getPath();
        const fileURLToPath = getFileURLToPath();

        try {
            const filePath = fileURLToPath(fileUrl);
            if (audioCache.has(filePath)) {
                console.log('✓ Cache HIT:', path.basename(filePath));
                return audioCache.get(filePath);
            }
            console.log('✗ Cache MISS:', path.basename(filePath), '- Reading from disk...');
            const data = await fs.promises.readFile(filePath);
            const base64Data = data.toString('base64');
            if (audioCache.size >= MAX_AUDIO_CACHE_SIZE) {
                const firstKey = audioCache.keys().next().value;
                audioCache.delete(firstKey);
                console.log('🗑️ Evicted oldest song from cache:', path.basename(firstKey));
            }
            //return audioData;
            audioCache.set(filePath, base64Data);
            console.log('💾 Cached audio:', path.basename(filePath));
            return base64Data;
        } catch (error) {
            console.error('❌ Error loading audio:', error);
            throw error;
        }
    });
}

function startApp() {
    const app = getApp()
    const BrowserWindow = getBrowserWindow();
    if (!app) throw new Error('Electron app module missing!');
    if (!BrowserWindow) throw new Error('Electron browserwindow module missing!');
    app.whenReady().then(async () => {
        console.log('whenReady');
        const folder = await musicLocation();
        MUSIC_FOLDER = folder;
        createWindow();
        setupWindowControlIPC();
        setupFileHandlers();
        setupArtistsWindowIPC();
        if (folder) {
            console.log('Starting watcher on:', folder);
            startWatching(folder, isRPi);
        } else {
            console.warn('No music folder selected. Watcher not started');
        }
    }).catch((err) => {
        console.error('Application failed, sorry!', err);
    });

    app.on('window-all-closed', () => {
        if (watcher) {
            watcher.close();
        }
        metadataCache.clear();
        audioCache.clear();
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow && BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}

startApp();



// app.on('before-quit', () => {
//     if (watcher) {
//         watcher.close();
//     }
//     metadataCache.clear();
//     audioCache.clear();
// })