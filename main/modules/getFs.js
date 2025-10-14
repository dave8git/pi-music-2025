const lazyLoadModule = require('../utils/lazyLoadModule');
const getFs = lazyLoadModule('fs'); // tutaj moduł fs jeszcze nie jest ładowany, zwrocona jest funkcja getFs i to ona wywoła require('fs') później, kiedy będzie potrzebne. 

module.exports = getFs;