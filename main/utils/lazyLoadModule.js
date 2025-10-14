function lazyLoadModule(moduleName) {
    let cachedModule = undefined;
    return function getModule() {  /// getModule będzie żyło po wykonaniu funkcji - do mmomentu przypisania null. 
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
};

module.exports = lazyLoadModule;