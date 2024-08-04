import fs from "node:fs";
import path from "node:path";
import GlobPatterns from "#lib/glob/patterns";

const SERVICE_FILES = [ "/**/.git", "/**/node_modules" ];

const IGNORE_GILES = {
    ".gitignore": {
        "root": ".git",
        "rootRequired": false,
        "subdirectories": true,
        "relativeGlobstar": true,
        "ignoreGlobstar": false,
    },
    ".lintignore": {
        "root": ".git",
        "rootRequired": false,
        "subdirectories": true,
        "relativeGlobstar": true,
        "ignoreGlobstar": false,
    },
    ".npmignore": {
        "root": "package.json",
        "rootRequired": false,
        "subdirectories": true,
        "relativeGlobstar": true,
        "ignoreGlobstar": false,
    },
    ".dockerignore": {
        "root": ".",
        "rootRequired": true,
        "subdirectories": false,
        "relativeGlobstar": false,
        "ignoreGlobstar": true,
    },
};

class Glob {
    #cwd;
    #files;
    #directories;
    #followSymlinks = true;
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
    #initIgnoreFile () {

        // init prefix
        this.#prefix = "";

        if ( !this.#ignoreFile ) return;

        this.#ignoreFileSpec = IGNORE_GILES[ this.#ignoreFile ];

        if ( !this.#ignoreFileSpec ) return;

        var root = this.#cwd,
            rootFound,
            parentDirectories = [];

        if ( this.#ignoreFileSpec.root === "." ) {
            rootFound = true;

            parentDirectories.push( root );
        }
        else {
            if ( !this.#ignoreFileSpec.root ) rootFound = true;

            while ( true ) {
                parentDirectories.push( root );

                // project root found
                if ( this.#ignoreFileSpec.root && fs.existsSync( root + "/" + this.#ignoreFileSpec.root ) ) {
                    rootFound = true;

                    break;
                }

                const parent = path.dirname( root );
                if ( parent === root ) break;

                root = parent;
            }
        }

        // root not found but required
        if ( !rootFound && this.#ignoreFileSpec.rootRequired ) {

            // do not use ignore file
            this.#ignoreFileSpec = null;

            return;
        }

        // subdirectories are allowed
        if ( this.#ignoreFileSpec.subdirectories ) {

            // remove cwd, because it will be processed in readDir mwthod
            parentDirectories.shift();
        }

        // subdirectories are NOT allowed
        else {

            // process root directory only
            parentDirectories = [ root ];
        }

        this.#prefix = path.posix.relative( root, this.#cwd );

        for ( const parentDirectory of parentDirectories ) {
            const prefix = path.posix.relative( root, parentDirectory );

            this.#addIgnoreFiles( parentDirectory, prefix );
        }
    }

    #addIgnoreFiles ( directory, prefix ) {
        if ( !this.#ignoreFileSpec ) return;

        const ignoreFile = directory + "/" + this.#ignoreFile;

        if ( !fs.existsSync( ignoreFile ) ) return;

        const content = fs.readFileSync( ignoreFile, "utf8" );

        console.log( "---", content );

        for ( let pattern of content.split( "\n" ) ) {
            pattern = pattern.trim();

            if ( !pattern || pattern.startsWith( "#" ) ) continue;

            this.#ignoreList.add( pattern, { prefix, "relativeGlobstar": this.#ignoreFileSpec.relativeGlobstar } );

            if ( this.#ignoreFileSpec.ignoreGlobstar && pattern.startsWith( "!" ) ) {
                this.#ignoreList.add( pattern + "/**", { prefix, "relativeGlobstar": this.#ignoreFileSpec.relativeGlobstar } );
            }
        }
    }

    #readDir ( cwdRelativeDirectory, depth ) {
        const absoluteDirectory = path.posix.join( this.#cwd, cwdRelativeDirectory );

        const prefix = path.posix.join( this.#prefix, cwdRelativeDirectory );

        // process ignore file
        if ( this.#ignoreFileSpec?.subdirectories ) {
            this.#addIgnoreFiles( absoluteDirectory, prefix );
        }

        const subDirectories = [];

        for ( const entry of fs.readdirSync( absoluteDirectory, { "withFileTypes": true } ) ) {
            const type = this.#getEntryType( absoluteDirectory, entry );

            if ( type === "directory" ) {

                // directory is ignored
                if ( this.#ignoreList.match( entry.name, { prefix } ) ) continue;

                const foundPath = path.posix.join( cwdRelativeDirectory, entry.name );

                if ( this.#directories && this.#searchList.match( entry.name, { prefix } ) ) {
                    this.#found.push( foundPath + this.#directoryMark );
                }

                if ( depth < this.#maxDepth ) subDirectories.push( foundPath );
            }
            else if ( this.#files && type === "file" ) {
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

    #getEntryType ( root, entry ) {
        var type;

        if ( this.#followSymlinks && entry.isSymbolicLink() ) {
            const target = fs.readlinkSync( path.posix.join( root, entry.name ) );

            const stat = fs.statSync( target );

            if ( stat.isDirectory() ) {
                type = "directory";
            }
            else if ( stat.isFile() ) {
                type = "file";
            }
        }
        else if ( entry.isDirectory() ) {
            type = "directory";
        }
        else if ( entry.isFile() ) {
            type = "file";
        }

        return type;
    }
}

export default function glob ( patterns, options ) {
    return new Glob( options ).find( patterns );
}
