import fs from "node:fs";
import path from "node:path";
import GlobPatterns from "#lib/glob/patterns";

const SERVICE_FILES = ["/**/.git", "/**/node_modules"];

class Glob {
    #cwd;
    #files;
    #directories;
    #markDirectories;
    #ignore;
    #ignoreServiceFiles;
    #ignoreFile;
    #caseSensitive;
    #sort;

    #prefix = "";
    #searchList;
    #ignoreList;
    #directoryMark;
    #found = [];

    constructor ( { cwd, files = true, directories, markDirectories, ignore, ignoreServiceFiles = true, ignoreFile, caseSensitive, sort } = {} ) {
        if ( !files ) directories ??= true;

        caseSensitive ??= process.platform === "win32" ? false : true;

        this.#cwd = ( cwd ? path.resolve( process.cwd(), cwd ) : process.cwd() ).replaceAll( "\\", "/" );
        this.#files = files;
        this.#directories = directories;
        this.#markDirectories = markDirectories;
        this.#ignore = ignore;
        this.#ignoreServiceFiles = ignoreServiceFiles;
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

        if ( this.#ignoreServiceFiles ) this.#ignoreList.add( SERVICE_FILES );

        this.#initIgnoreFiles();

        this.#searchList.add( patterns, { "prefix": this.#prefix } );
        this.#ignoreList.add( this.#ignore, { "prefix": this.#prefix } );

        this.#readDir( "" );

        return this.#found;
    }

    // private
    #initIgnoreFiles () {

        // init prefix
        this.#prefix = "";

        if ( !this.#ignoreFile ) return;

        var root = this.#cwd;

        const parentDirectories = [];

        var startDirectory = true;

        while ( true ) {
            if ( !startDirectory ) parentDirectories.push( root );

            startDirectory = false;

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

        for ( let pattern of content.split( "\n" ) ) {
            pattern = pattern.trim();

            if ( !pattern || pattern.startsWith( "#" ) ) continue;

            this.#ignoreList.add( pattern, { prefix, "relativeGlobstar": true } );
        }
    }

    #readDir ( cwdRelativeDirectory ) {
        const absoluteDirectory = path.posix.join( this.#cwd, cwdRelativeDirectory );

        const prefix = path.posix.join( this.#prefix, cwdRelativeDirectory );

        this.#addIgnoreFiles( absoluteDirectory, prefix );

        var files = [],
            directories = [];

        for ( const entry of fs.readdirSync( absoluteDirectory, { "withFileTypes": true } ) ) {
            if ( entry.isDirectory() ) {
                directories.push( entry.name );
            }
            else if ( this.#files && entry.isFile() ) {
                files.push( entry.name );
            }
        }

        // sort
        if ( this.#sort ) {
            files = files.sort();
            directories = directories.sort();
        }

        // process files
        for ( const name of files ) {
            if ( this.#searchList.match( name, { prefix } ) && !this.#ignoreList.match( name, { prefix } ) ) {
                const foundPath = path.posix.join( cwdRelativeDirectory, name );

                this.#found.push( foundPath );
            }
        }

        // process directories
        for ( const name of directories ) {

            // directory is ignored
            if ( this.#ignoreList.match( name, { prefix } ) ) continue;

            const foundPath = path.posix.join( cwdRelativeDirectory, name );

            if ( this.#directories && this.#searchList.match( name, { prefix } ) ) {
                this.#found.push( foundPath + this.#directoryMark );
            }

            this.#readDir( foundPath );
        }
    }
}

export default function glob ( patterns, options ) {
    return new Glob( options ).find( patterns );
}
