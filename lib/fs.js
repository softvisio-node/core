const fs = require( "fs" );
const path = require( "path" );
const os = require( "os" );
const { "v4": uuidv4 } = require( "uuid" );

module.exports = fs;

module.exports.fileTree = function fileTree () {
    const FileTree = require( "./fs/file-tree" );

    return new FileTree();
};

module.exports.config = require( "./fs/config" );

module.exports.tmp = {
    file ( options = {} ) {
        const prefix = options.prefix || os.tmpdir(),
            ext = options.ext || "";

        const temp = new String( path.join( prefix, uuidv4() + ext ) );

        temp.unlinkSync = function () {
            fs.unlinkSync( this.toString() );
        };

        return temp;
    },

    dir ( options = {} ) {
        const prefix = options.prefix || os.tmpdir();

        const temp = new String( path.join( prefix, uuidv4() ) );

        temp.unlinkSync = function () {
            fs.rmdirSync( this.toString(), { "recursive": true } );
        };

        return temp;
    },
};

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
