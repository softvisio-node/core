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

// TODO
module.exports.filetree = function fileTree () {
    return;
};

module.exports.config = require( "./fs/config" );

module.exports.tmp = {
    file ( options = {} ) {
        const prefix = options.prefix || os.tmpdir();
        const ext = options.ext || "";

        const temp = path.join( prefix, uuidv4() + ext );

        return temp;
    },
};
