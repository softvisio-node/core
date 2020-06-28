const fs = require( "fs" );
const path = require( "path" );
const os = require( "os" );
const { "v4": uuidv4 } = require( "uuid" );

module.exports = fs;

// args: depth, abs
// TODO implement deps
/*
name: readTree
summary: Reads directory tree
description: Reads directory tree recursively on defined depth
example: |
    await readTree( ".", { depth: 3, abs: true } );
params:
    - name: dir
      summary: directory to read
      required: true
      schema:
        type: string
    - name: options
      summary: options
      schema:
          type: object
        properties:
            depth:
                type: integer
                minimum: 0
            abs:
                type: boolean
*/
module.exports.readTree = async function ( dir, args ) {
    args = args || {};

    var readDir = async function ( dir, relDir ) {
        const dirents = await fs.promises.readdir( dir, { "withFileTypes": true } );

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
};

module.exports.getHash = function ( path, algorithm, digest = "hex" ) {
    return new Promise( ( resolve, reject ) => {
        const crypto = require( "crypto" ),
            hash = crypto.createHash( algorithm ),
            stream = fs.ReadStream( path );

        stream.once( "error", ( e ) => reject( e ) );

        stream.on( "data", ( data ) => hash.update( data ) );

        stream.once( "end", () => resolve( hash.digest( digest ) ) );
    } );
};
