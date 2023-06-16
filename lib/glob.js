import fs from "node:fs";
import path from "node:path";
import GlobPatterns from "#lib/glob/patterns";

class Glob {

    // public
    find ( pattern, { cwd, files = true, directories, markDirectories, ignore, ignoreFile, caseSensitive, sort } = {} ) {
        if ( !files ) directories ??= true;

        const found = [];

        cwd ||= process.cwd();

        if ( !fs.existsSync( cwd ) ) return found;

        const directoryMark = markDirectories ? "/" : "";

        caseSensitive ??= process.platform === "win32" ? false : true;

        const allowedPatterns = new GlobPatterns( { caseSensitive } ).add( pattern ),
            ignoredPatterns = new GlobPatterns( { "ignore": true, caseSensitive } ).add( ignore );

        if ( ignoreFile === ".lintignore" ) {

            // XXX
        }

        const readDir = function ( root ) {
            const directory = path.posix.join( cwd, root );

            for ( const file of fs.readdirSync( directory, { "withFileTypes": true } ) ) {

                // file
                if ( file.isFile() ) {
                    if ( !files ) continue;

                    if ( allowedPatterns.match( file.name, { root } ) && !ignoredPatterns.match( file.name, { root } ) ) {
                        const foundPath = path.posix.join( root, file.name );

                        found.push( foundPath );
                    }
                }

                // directory
                else if ( file.isDirectory() ) {

                    // directory is ignored
                    if ( ignoredPatterns.match( file.name, { root } ) ) continue;

                    const foundPath = path.posix.join( root, file.name );

                    if ( directories && allowedPatterns.match( file.name, { root } ) ) {
                        found.push( foundPath + directoryMark );
                    }

                    readDir( foundPath );
                }
            }
        };

        readDir( "" );

        if ( sort ) {
            return found.sort();

            // return found.sort( ( a, b ) => ( a.length < b.length ? -1 : a.length > b.length ? 1 : 0 ) );
        }
        else {
            return found;
        }
    }
}

export default function glob ( patterns, options ) {
    return new Glob( options ).find( patterns, options );
}
