const { ipcRenderer } = require('electron');

/* button event handlers */

document.querySelector('.minimize').addEventListener('click', () => {
  console.log('minimize');
  window.api.windowControl('minimize');
});

document.querySelector('.maximize').addEventListener('click', () => {
  console.log('maximize');
  window.api.windowControl('maximize');
});

document.querySelector('.close').addEventListener('click', () => {
  console.log('close');
  window.api.windowControl('close');
});


ipcRenderer.on('music-events', (event, updates) => {
  updates.forEach(update => {
    console.log(`Event: ${update.type}, File: ${update.path}`);
    // handle in your UI:
    // - add song to list
    // - refresh metadata
    // - remove deleted song
  });
});
