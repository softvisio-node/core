import fs from "node:fs";
import path from "node:path";
import GlobPatterns from "#lib/glob/patterns";

const DEFAULT_IGNORE = ["/**/.git", "/**/node_modules"];

class Glob {
    #cwd;
    #files;
    #directories;
    #markDirectories;
    #ignore;
    #ignoreDefault;
    #ignoreFile;
    #caseSensitive;
    #sort;

    #searchList;
    #ignoreList;
    #directoryMark;
    #found = [];

    constructor ( { cwd, files = true, directories, markDirectories, ignore, ignoreDefault, ignoreFile, caseSensitive, sort } = {} ) {
        if ( !files ) directories ??= true;

        caseSensitive ??= process.platform === "win32" ? false : true;

        this.#cwd = cwd || process.cwd();
        this.#files = files;
        this.#directories = directories;
        this.#markDirectories = markDirectories;
        this.#ignore = ignore;
        this.#ignoreDefault = ignoreDefault;
        this.#ignoreFile = ignoreFile;
        this.#caseSensitive = caseSensitive;
        this.#sort = sort;

        this.#directoryMark = this.#markDirectories ? "/" : "";
    }

    // public
    find ( patterns ) {
        if ( !fs.existsSync( this.#cwd ) ) return this.#found;

        this.#searchList = new GlobPatterns( {
            "caseSensitive": this.#caseSensitive,
        } ).add( patterns );

        this.#ignoreList = new GlobPatterns( {
            "ignore": true,
            "caseSensitive": this.#caseSensitive,
        } ).add( this.#ignore );

        if ( this.#ignoreDefault ) this.#ignoreList.add( DEFAULT_IGNORE );

        this.#readDir( "" );

        if ( this.#sort ) {
            return this.#found.sort();

            // return found.sort( ( a, b ) => ( a.length < b.length ? -1 : a.length > b.length ? 1 : 0 ) );
        }
        else {
            return this.#found;
        }
    }

    // private
    #readDir ( root ) {
        const directory = path.posix.join( this.#cwd, root );

        for ( const file of fs.readdirSync( directory, { "withFileTypes": true } ) ) {

            // file
            if ( file.isFile() ) {
                if ( !this.#files ) continue;

                if ( this.#searchList.match( file.name, { root } ) && !this.#ignoreList.match( file.name, { root } ) ) {
                    const foundPath = path.posix.join( root, file.name );

                    this.#found.push( foundPath );
                }
            }

            // directory
            else if ( file.isDirectory() ) {

                // directory is ignored
                if ( this.#ignoreList.match( file.name, { root } ) ) continue;

                const foundPath = path.posix.join( root, file.name );

                if ( this.#directories && this.#searchList.match( file.name, { root } ) ) {
                    this.#found.push( foundPath + this.#directoryMark );
                }

                this.#readDir( foundPath );
            }
        }
    }
}

export default function glob ( patterns, options ) {
    return new Glob( options ).find( patterns );
}
