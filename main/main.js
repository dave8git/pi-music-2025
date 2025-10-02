const { app, BrowserWindow, ipcMain, dialog } = require('electron'); // app --> controls application lifecycle (for example app.whenReady)
//app: Controls your application’s lifecycle (start, quit, etc.).
//BrowserWindow: Creates and manages windows where your HTML/CSS/JS is rendered.
//ipcMain: Handles communication from renderer processes (frontend) to main process.
//Menu: Create custom application menus.
//dialog: Open native system dialogs (file pickers, alerts, etc.).
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require("os");
const parentPathPreload = path.dirname(__dirname);
const preloadPath = path.join(parentPathPreload, 'preload', 'preload.js')
let mainWindow;
function createWindow() {

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

const homeDir = os.homedir();
const homePath = path.join(homeDir, 'Downloads', 'music_folder');
let selectedFolder = null;
console.log('homeDir', homeDir);
console.log('homePath', homePath);

async function musicFilesExists(directoryPath) {
    try {
        const directoryFiles = await fs.readdir(directoryPath);
        console.log('directoryFiles', directoryFiles);
        const mp3files = directoryFiles.filter(file => file.toLowerCase().endsWith(".mp3"));
        console.log('mp3files', mp3files);
        return mp3files.length > 0;
    } catch {
        return false;
    }
}

async function musicLocation() {
    try {
        if (fsSync.existsSync(homePath) && fsSync.lstatSync(homePath).isDirectory()) {
            if (await musicFilesExists(homePath)) {
                selectedFolder = homePath;
            }
        } else {
            const result = await dialog.showOpenDialog(mainWindow, { // otwiera okno i pozwala wybrać katalog
                properties: ['openDirectory'],
            });
            if(!result.canceled && result.filePaths.length > 0){
                const chosenPath = result.filePaths[0]; 
                if (await musicFilesExists(chosenPath)) {
                    selectedFolder = chosenPath;
                } else {
                    const newFolderName = path.join(chosenPath, 'music_folder');
                    fsSync.mkdirSync(newFolderName, {recursive: true });
                    selectedFolder = chosenPath;
                }
            } 
        }
    } catch (err) {
        console.log('Error:', err);
    }
    // try {
    //     const files = await fs.readdir(homePath)
    //     console.log('files', files);
    // } catch (err) {
    //     console.error('err1', err);
    // }
    return selectedFolder;
}

// async function createWindowApp() { // to samo co ponizej tylko ze skladnia async...await
//     try {
//         await app.whenReady();
//         createWindow();
//     } catch (err) {
//         console.error(err);
//     }
// }

app.whenReady().then(() => {
    console.log('whenReady');
    musicLocation();
    createWindow();
}).catch((err) => {
    console.error('Application failed, sorry!', err);
}); // app.whenReady() --> app will start only after electron finishes initializing everything like: loading native modules, setting up main process, read the app resources (pictures, music, disk files etc.)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});


/// ---> Dalej Step 4. podpunkt 3. Configure the window: Set it to be frameless (since you'll create custom controls), transparent, and configure the preload script path for security.