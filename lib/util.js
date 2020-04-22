module.exports.sleep = async function ( timeout ) {
    return new Promise( ( resolve ) => setTimeout( resolve, timeout ) );
};

// args: depth, abs
// TODO implement deps
module.exports.readTree = async function ( dir, args ) {
    const path = require( "path" );
    const { readdir } = require( "fs" ).promises;

    args = args || {};

    var readDir = async function ( dir, relDir ) {
        const dirents = await readdir( dir, { "withFileTypes": true } );

        const files = await Promise.all( dirents.map( ( dirent ) => {
            if ( dirent.isDirectory() ) {
                return readDir( dir + "/" + dirent.name, relDir + "/" + dirent.name );
            }
            else {
                if ( args.abs ) {
                    return path.resolve( dir, dirent.name );
                }
                else {
                    return path.posix.normalize( "./" + relDir + "/" + dirent.name );
                }
            }
        } ) );

        return files.flat();
    };

    return await readDir( dir, "." );
};
