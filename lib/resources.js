const path = require( "path" );

const resolve = {};

module.exports = function getResources ( packageName, resource ) {
    var resourcesPath = resolve[packageName];

    if ( !resourcesPath ) {
        const packagePath = require.resolve( packageName + "/package.json" );

        resourcesPath = path.dirname( packagePath ) + "/resources";

        resolve[packageName] = resourcesPath;
    }

    return resource ? resourcesPath + "/" + resource : resourcesPath;
};
