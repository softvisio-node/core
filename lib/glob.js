import fs from "node:fs";
import path from "node:path";
import GlobPatterns from "#lib/glob/patterns";

const SERVICE_FILES = ["/**/.git", "/**/node_modules"];

const IGNORE_GILES = {
    ".gitignore": {
        "root": "git",
        "subdirectories": true,
        "relativeGlobStar": true,
    },
    ".lintignore": {
        "root": "git",
        "subdirectories": true,
        "relativeGlobStar": true,
    },
    ".npmignore": {
        "root": "package",
        "subdirectories": true,
        "relativeGlobStar": true,
    },
    ".dockerignore": {
        "root": "cwd",
        "subdirectories": false,
        "relativeGlobStar": false,
    },
};

class Glob {
    #cwd;
    #files;
    #directories;
    #markDirectories;
    #ignore;
    #ignoreServiceFiles;
    #ignoreFile;
    #caseSensitive;
    #maxDepth;

    #prefix = "";
    #searchList;
    #ignoreList;
    #directoryMark;
    #found = [];
    #ignoreFileSpec;

    constructor ( { cwd, files = true, directories, markDirectories, ignore, ignoreServiceFiles = true, ignoreFile, caseSensitive, maxDepth } = {} ) {
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
        this.#maxDepth = maxDepth || Infinity;

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

        this.#initIgnoreFile();

        this.#searchList.add( patterns, { "prefix": this.#prefix } );
        this.#ignoreList.add( this.#ignore, { "prefix": this.#prefix } );

        if ( this.#searchList.depth < this.#maxDepth ) {
            this.#maxDepth = this.#searchList.depth;
        }

        if ( this.#maxDepth ) this.#readDir( "", 1 );

        return this.#found;
    }

    // private
    // XXX
    #initIgnoreFile () {

        // init prefix
        this.#prefix = "";

        if ( !this.#ignoreFile ) return;

        this.#ignoreFileSpec = IGNORE_GILES[this.#ignoreFile];

        if ( !this.#ignoreFileSpec ) return;

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

    // XXX
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

    // XXX
    #readDir ( cwdRelativeDirectory, depth ) {
        const absoluteDirectory = path.posix.join( this.#cwd, cwdRelativeDirectory );

        const prefix = path.posix.join( this.#prefix, cwdRelativeDirectory );

        // XXX
        this.#addIgnoreFiles( absoluteDirectory, prefix );

        const subDirectories = [];

        for ( const entry of fs.readdirSync( absoluteDirectory, { "withFileTypes": true } ) ) {
            if ( entry.isDirectory() ) {

                // directory is ignored
                if ( this.#ignoreList.match( entry.name, { prefix } ) ) continue;

                const foundPath = path.posix.join( cwdRelativeDirectory, entry.name );

                if ( this.#directories && this.#searchList.match( entry.name, { prefix } ) ) {
                    this.#found.push( foundPath + this.#directoryMark );
                }

                if ( depth < this.#maxDepth ) subDirectories.push( foundPath );
            }
            else if ( this.#files && entry.isFile() ) {
                if ( this.#searchList.match( entry.name, { prefix } ) && !this.#ignoreList.match( entry.name, { prefix } ) ) {
                    const foundPath = path.posix.join( cwdRelativeDirectory, entry.name );

                    this.#found.push( foundPath );
                }
            }
        }

        // process sub-directories
        for ( const name of subDirectories ) {
            this.#readDir( name, depth + 1 );
        }
    }
}

export default function glob ( patterns, options ) {
    return new Glob( options ).find( patterns );
}
