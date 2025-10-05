function lazyLoadModule(moduleName) {
    let cachedModule = undefined;
    return function getModule() {
        if (cachedModule !== undefined) return cachedModule;
        try {
            cachedModule = require(moduleName);
            return cachedModule;
        } catch (err) {
            console.error(`Lazy-load failed for module "${moduleName}":`, err);
            cachedModule = null;
            return null
        }
    };
}

const getFs = lazyLoadModule('fs'); // tutaj moduł fs jeszcze nie jest ładowany, zwrocona jest funkcja getFs i to ona wywoła require('fs') później, kiedy będzie potrzebne. 
const getFsPromises = lazyLoadModule('fs/promises');
const getPath = lazyLoadModule('path');
const getOs = lazyLoadModule('os');
const getElectron = lazyLoadModule('electron');

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

let mainWindow;
let selectedFolder = null;

function createWindow() {
    const BrowserWindow = getBrowserWindow();
    const path = getPath();

    if (!BrowserWindow || !path) return;

    const parentPathPreload = path.dirname(__dirname);
    const preloadPath = path.join(parentPathPreload, 'preload', 'preload.js');

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        transparent: true, // window background transparent
        resizable: true,
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

async function musicFilesExists(directoryPath) {
    const fsPromise = getFsPromises();
    if (!fsPromise) return false;
    try {
        const directoryFiles = await fsPromise.readdir(directoryPath);
        const mp3files = directoryFiles.filter(file => file.toLowerCase().endsWith(".mp3"));
        return mp3files.length > 0;
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
            if (await musicFilesExists(homePath)) {
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
                    fsSync.mkdirSync(newFolderName, { recursive: true });
                    selectedFolder = chosenPath;
                }
            }
        }
    } catch (err) {
        console.log('Error selecting music folder:', err);
    }
    return selectedFolder;
}

function startApp() {
    const app = getApp()
    if (!app) throw new Error('Electron app module missing!');
    app.whenReady().then(async () => {
        console.log('whenReady');
        await musicLocation();
        createWindow();
        setupWindowControlIPC();
    }).catch((err) => {
        console.error('Application failed, sorry!', err);
    }); // app.whenReady() --> app will start only after electron finishes initializing everything like: loading native modules, setting up main process, read the app resources (pictures, music, disk files etc.)

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
        if (BrowserWindow && BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}

startApp();