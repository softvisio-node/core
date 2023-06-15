import fs from "node:fs";
import path from "node:path";
import GlobPatterns from "#lib/glob/patterns";

// XXX if directory ignored - ignore completely

export default function glob ( pattern, { cwd, files = true, directories, markDirectories, ignore } = {} ) {
    const found = [];

    cwd ||= process.cwd();

    if ( !fs.existsSync( cwd ) ) return files;

    const directoryMark = markDirectories ? "/" : "";

    const allowedPatterns = new GlobPatterns().add( pattern ),
        ignoredPatterns = new GlobPatterns().add( ignore );

    const readDir = function ( root ) {
        const directory = path.posix.join( cwd, root );

        for ( const file of fs.readdirSync( directory, { "withFileTypes": true } ) ) {
            if ( files && file.isFile() ) {
                if ( allowedPatterns.match( file.name, { root } ) && !ignoredPatterns.matchIgnored( file.name, { root } ) ) {
                    const foundPath = path.posix.join( root, file.name );

                    found.push( foundPath );
                }
            }
            else if ( file.isDirectory() ) {
                if ( allowedPatterns.match( file.name, { root } ) && !ignoredPatterns.matchIgnored( file.name, { root } ) ) {
                    const foundPath = path.posix.join( root, file.name );

                    if ( directories ) {
                        found.push( foundPath + directoryMark );
                    }

                    readDir( foundPath );
                }
            }
        }
    };

    readDir( "" );

    return found;
}
