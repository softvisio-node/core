import fs from "node:fs";
import path from "node:path";
import GlobPatterns from "#lib/glob/patterns";

// XXX
const SERVICE_FILES = [

        //
        "/**/.git/",
        "/**/node_modules/",
    ],
    IGNORE_FILES = {
        ".gitignore": {
            "root": ".git",
            "rootRequired": false,
            "subdirectories": true,
            "filenameMatchEverywhere": true,
            "allowNegated": true,
            "allowGlobstar": true,
            "allowBraces": false,
            "allowExtglob": false,
        },
        ".lintignore": {
            "root": ".git",
            "rootRequired": false,
            "subdirectories": true,
            "filenameMatchEverywhere": false,
            "allowNegated": true,
            "allowGlobstar": true,
            "allowBraces": true,
            "allowExtglob": true,
        },
        ".npmignore": {
            "root": "package.json",
            "rootRequired": false,
            "subdirectories": true,
            "filenameMatchEverywhere": true,
            "allowNegated": true,
            "allowGlobstar": true,
            "allowBraces": false,
            "allowExtglob": false,
        },
        ".dockerignore": {
            "root": ".",
            "rootRequired": true,
            "subdirectories": false,
            "filenameMatchEverywhere": false,
            "allowNegated": true,
            "allowGlobstar": false,
            "allowBraces": true,
            "allowExtglob": false,
        },
    };

class Glob {
    #cwd;
    #files;
    #directories;
    #followSymlinks;
    #absolute;
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

    constructor ( { cwd, files = true, directories, followSymlinks = true, absolute, markDirectories, ignore, ignoreServiceFiles = true, ignoreFile, caseSensitive, maxDepth } = {} ) {
        if ( !files ) directories ??= true;

        caseSensitive ??= process.platform === "win32"
            ? false
            : true;

        this.#cwd = ( cwd
            ? path.resolve( process.cwd(), cwd )
            : process.cwd() ).replaceAll( "\\", "/" );
        this.#files = files;
        this.#directories = directories;
        this.#followSymlinks = !!followSymlinks;
        this.#absolute = !!absolute;
        this.#markDirectories = !!markDirectories;
        this.#ignore = ignore;
        this.#ignoreServiceFiles = ignoreServiceFiles;
        this.#ignoreFile = ignoreFile;
        this.#caseSensitive = !!caseSensitive;
        this.#maxDepth = maxDepth || Infinity;

        this.#directoryMark = this.#markDirectories
            ? "/"
            : "";
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

        if ( this.#maxDepth ) this.#readDir( "", 1 );

        if ( this.#absolute ) {
            return this.#found.map( file => path.posix.join( this.#cwd, file ) );
        }
        else {
            return this.#found;
        }
    }

    // private
    #initIgnoreFile () {

        // init prefix
        this.#prefix = "";

        if ( !this.#ignoreFile ) return;

        this.#ignoreFileSpec = IGNORE_FILES[ this.#ignoreFile ];

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

        for ( let pattern of content.split( "\n" ) ) {
            pattern = pattern.trim();

            // comment
            if ( !pattern || pattern.startsWith( "#" ) ) continue;

            // XXX
            if ( this.#ignoreFileSpec.filenameMatchEverywhere ) {
                if ( !pattern.includes( "/" ) ) {
                    pattern = "/**/" + pattern;
                }
            }

            this.#ignoreList.add( pattern, {
                prefix,
                "allowNegated": this.#ignoreFileSpec.allowNegated,
                "allowGlobstar": this.#ignoreFileSpec.allowGlobstar,
                "allowBraces": this.#ignoreFileSpec.allowBraces,
                "allowExtglob": this.#ignoreFileSpec.allowExtglob,

                // XXX adds "**/" to the relative patterns
                // false for .dockerignore
                "relativeGlobstar": this.#ignoreFileSpec.relativeGlobstar,
            } );

            // XXX for .dockerignore only
            if ( this.#ignoreFileSpec.ignoreGlobstar && pattern.startsWith( "!" ) ) {
                this.#ignoreList.add( pattern + "/**", {
                    prefix,
                    "relativeGlobstar": this.#ignoreFileSpec.relativeGlobstar,
                } );
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
                if ( this.#ignoreList.test( entry.name, { prefix } ) ) continue;

                const foundPath = path.posix.join( cwdRelativeDirectory, entry.name );

                if ( this.#directories && this.#searchList.test( entry.name, { prefix } ) ) {
                    this.#found.push( foundPath + this.#directoryMark );
                }

                if ( depth < this.#maxDepth ) subDirectories.push( foundPath );
            }
            else if ( this.#files && type === "file" ) {
                if ( this.#searchList.test( entry.name, { prefix } ) && !this.#ignoreList.test( entry.name, { prefix } ) ) {
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

export async function glob ( patterns, options ) {
    return new Glob( options ).find( patterns );
}

export function globSync ( patterns, options ) {
    return new Glob( options ).find( patterns );
}
