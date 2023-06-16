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

    #prefix = "";
    #searchList;
    #ignoreList;
    #directoryMark;
    #found = [];

    constructor ( { cwd, files = true, directories, markDirectories, ignore, ignoreDefault, ignoreFile, caseSensitive, sort } = {} ) {
        if ( !files ) directories ??= true;

        caseSensitive ??= process.platform === "win32" ? false : true;

        this.#cwd = ( cwd ? path.resolve( process.cwd(), cwd ) : process.cwd() ).replaceAll( "\\", "/" );
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
        } );

        this.#ignoreList = new GlobPatterns( {
            "ignore": true,
            "caseSensitive": this.#caseSensitive,
        } );

        if ( this.#ignoreDefault ) this.#ignoreList.add( DEFAULT_IGNORE );

        if ( this.#ignoreFile ) this.#findIgnoreFiles();

        this.#searchList.add( patterns, { "root": this.#prefix } );
        this.#ignoreList.add( this.#ignore, { "root": this.#prefix } );

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
    #findIgnoreFiles () {
        var root = this.#cwd;

        const ignoreFiles = [];

        while ( true ) {
            const ignoreFilePath = path.posix.join( root, this.#ignoreFile );

            if ( fs.existsSync( ignoreFilePath ) ) {
                ignoreFiles.push( ignoreFilePath );
            }

            // project root found
            if ( fs.existsSync( root + "/.git" ) ) {
                break;
            }

            const parent = path.dirname( root );
            if ( parent === root ) break;
            root = parent;
        }

        this.#prefix = path.posix.relative( root, this.#cwd );

        for ( const ignoreFile of ignoreFiles ) {
            this.#applyIgnoreFile( ignoreFile, path.dirname( path.posix.relative( root, ignoreFile ) ) );
        }
    }

    #processIgnoreFiles ( directory, prefix ) {
        if ( !this.#ignoreFile ) return;

        this.#applyIgnoreFile( directory + "/" + !this.#ignoreFile, prefix );
    }

    #applyIgnoreFile ( path, prefix ) {
        if ( !fs.existsSync( path ) ) return;

        const content = fs.readFileSync( path, "utf8" );

        for ( let line of content.split( "\n" ) ) {
            line = line.trim();

            if ( !line || line.startsWith( "#" ) ) continue;

            this.#ignoreList.add( line, { "root": prefix } );
        }
    }

    #readDir ( root ) {
        const directory = path.posix.join( this.#cwd, root );

        const prefix = path.posix.join( this.#prefix, root );

        this.#processIgnoreFiles( directory, prefix );

        for ( const file of fs.readdirSync( directory, { "withFileTypes": true } ) ) {

            // file
            if ( file.isFile() ) {
                if ( !this.#files ) continue;

                if ( this.#searchList.match( file.name, { "root": prefix } ) && !this.#ignoreList.match( file.name, { "root": prefix } ) ) {
                    const foundPath = path.posix.join( root, file.name );

                    this.#found.push( foundPath );
                }
            }

            // directory
            else if ( file.isDirectory() ) {

                // directory is ignored
                if ( this.#ignoreList.match( file.name, { "root": prefix } ) ) continue;

                const foundPath = path.posix.join( root, file.name );

                if ( this.#directories && this.#searchList.match( file.name, { "root": prefix } ) ) {
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
