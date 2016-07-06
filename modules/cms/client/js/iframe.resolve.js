/* jslint node:true */
module.exports = function (basePath, origPathName) {
    var
        cleanBase = basePath.replace(/([^\/]{1})\/$/, '$1'),
        pathPrefix = cleanBase.replace(/.+?:\/\/.+?\/(.*)$/, '$1'),
        cleanPrefix = (pathPrefix && pathPrefix.length) ? (pathPrefix.replace(/([^\/]{1})\/$/, '$1')) : pathPrefix,
        pathName = origPathName.replace(/([^\/]{1})\/$/, '$1'),
        pathNameWithNoPrefix = (cleanPrefix && cleanPrefix.length) ? pathName.replace(new RegExp('^\/' + cleanPrefix),'') : pathName,
        adminPath = cleanBase.replace(/\/$/, '') + '/admin' + pathNameWithNoPrefix;

    /*
    console.log('BASE', basePath);
    console.log('CLEAN BASE', cleanBase);
    console.log('ORIG PATHNAME', origPathName);
    console.log('PREFIX', pathPrefix);
    console.log('CLEAN PREFIX', cleanPrefix);
    console.log('PATHNAME', pathName);
    console.log('PATHNAME WITHOUT PREFIX', pathNameWithNoPrefix);
    console.log('ADMIN PATH', adminPath);
    */

    return adminPath;
};
