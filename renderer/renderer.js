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