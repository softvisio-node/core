import fs from "node:fs";
import path from "node:path";
import GlobPatterns from "#lib/glob/patterns";

// XXX if directory ignored - ignore completely

export default function glob ( pattern, { cwd, markDirectories, ignore } = {} ) {
    const files = [];

    cwd ||= process.cwd();

    if ( !fs.existsSync( cwd ) ) return files;

    const globPatteerns = new GlobPatterns().add( pattern );

    const readDir = function ( root ) {
        for ( const file of fs.readdirSync( root, { "withFileTypes": true } ) ) {
            if ( file.isFile() ) {
                const absPath = path.posix.join( file.name );

                if ( globPatteerns.match( absPath ) ) {
                    files.push( absPath );
                }
            }
            else if ( file.isDirectory() ) {
                const absPath = path.posix.join( file.name );

                if ( globPatteerns.match( absPath ) ) {
                    files.push( absPath );

                    // readDir( absPath );
                }
            }
        }
    };

    readDir( cwd );

    return files;
}
