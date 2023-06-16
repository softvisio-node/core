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

        this.#initIgnoreFiles();

        this.#searchList.add( patterns, { "prefix": this.#prefix } );
        this.#ignoreList.add( this.#ignore, { "prefix": this.#prefix } );

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
    #initIgnoreFiles () {

        // init prefix
        this.#prefix = "";

        if ( !this.#ignoreFile ) return;

        var root = this.#cwd;

        const parentDirectories = [];

        while ( true ) {
            parentDirectories.push( root );

            // project root found
            if ( fs.existsSync( root + "/.git" ) ) {
                break;
            }

            const parent = path.dirname( root );
            if ( parent === root ) break;
            root = parent;
        }

        this.#prefix = path.posix.relative( root, this.#cwd );

        for ( const parentDirectory of parentDirectories ) {
            this.#addIgnoreFiles( parentDirectory, path.posix.relative( root, parentDirectory ) );
        }
    }

    #addIgnoreFiles ( directory, prefix ) {
        if ( !this.#ignoreFile ) return;

        const ignoreFile = directory + "/" + this.#ignoreFile;

        if ( !fs.existsSync( ignoreFile ) ) return;

        const content = fs.readFileSync( ignoreFile, "utf8" );

        for ( let line of content.split( "\n" ) ) {
            line = line.trim();

            if ( !line || line.startsWith( "#" ) ) continue;

            this.#ignoreList.add( line, { prefix } );
        }
    }

    #readDir ( cwdRelativeDirectory ) {
        const absoluteDirectory = path.posix.join( this.#cwd, cwdRelativeDirectory );

        const prefix = path.posix.join( this.#prefix, cwdRelativeDirectory );

        this.#addIgnoreFiles( absoluteDirectory, prefix );

        for ( const file of fs.readdirSync( absoluteDirectory, { "withFileTypes": true } ) ) {

            // file
            if ( file.isFile() ) {
                if ( !this.#files ) continue;

                if ( this.#searchList.match( file.name, { prefix } ) && !this.#ignoreList.match( file.name, { prefix } ) ) {
                    const foundPath = path.posix.join( cwdRelativeDirectory, file.name );

                    this.#found.push( foundPath );
                }
            }

            // directory
            else if ( file.isDirectory() ) {

                // directory is ignored
                if ( this.#ignoreList.match( file.name, { prefix } ) ) continue;

                const foundPath = path.posix.join( cwdRelativeDirectory, file.name );

                if ( this.#directories && this.#searchList.match( file.name, { prefix } ) ) {
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
