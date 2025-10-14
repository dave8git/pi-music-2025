const lazyLoadModule = require('../utils/lazyLoadModule');
const getElectron = lazyLoadModule('electron'); // tutaj moduł fs jeszcze nie jest ładowany, zwrocona jest funkcja getFs i to ona wywoła require('fs') później, kiedy będzie potrzebne. 

module.exports = getElectron;