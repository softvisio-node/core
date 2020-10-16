const fs = require( "fs" );

module.exports = fs;

module.exports.fileTree = function fileTree () {
    const FileTree = require( "./fs/file-tree" );

    return new FileTree();
};

module.exports.config = require( "./fs/config" );

module.exports.tmp = require( "./fs/tmp" );

module.exports.getHash = async function ( path, algorithm, digest = "hex" ) {
    return new Promise( ( resolve, reject ) => {
        const crypto = require( "crypto" ),
            hash = crypto.createHash( algorithm ),
            stream = fs.ReadStream( path );

        stream.once( "error", e => reject( e ) );

        stream.on( "data", data => hash.update( data ) );

        stream.once( "end", () => resolve( hash.digest( digest ) ) );
    } );
};
