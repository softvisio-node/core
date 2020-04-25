const fs = require( "fs" );
const path = require( "path" );

module.exports = fs;

// args: depth, abs
// TODO implement deps
/*
name: readtree
summary: Reads directory tree
description: Reads directory tree recursively on defined depth
example: |
    await readtree( ".", { depth: 3, abs: true } );
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
module.exports.readtree = async function ( dir, args ) {
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

module.exports.filetree = function filetree () {
    return;
};
