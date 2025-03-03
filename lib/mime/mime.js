import fs from "node:fs";
import path from "node:path";

function normalizeName ( name ) {
    return name.toLowerCase();
}

function normalizeExtname ( name ) {
    name = name.toLowerCase();

    if ( !name.startsWith( "." ) ) {
        name = "." + name;
    }

    return name;
}

class MimeTypeShebangs {
    #mimeType;
    #shebangs = new Set();

    constructor ( mimeType ) {
        this.#mimeType = mimeType;
    }

    // properties
    get size () {
        return this.#shebangs.size;
    }

    // public
    has ( shebang ) {
        return this.#shebangs.has( normalizeName( shebang ) );
    }

    add ( shebangs ) {
        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            shebang = normalizeName( shebang );

            if ( !this.#shebangs.has( shebang ) ) {
                this.#shebangs.add( shebang );

                this.#mimeType.mime?.shebangs.add( this.#mimeType, shebang );
            }
        }

        return this;
    }

    delete ( shebangs ) {
        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            shebang = normalizeName( shebang );

            if ( this.#shebangs.has( shebang ) ) {
                this.#shebangs.delete( shebang );

                this.#mimeType.mime?.shebangs.delete( shebang );
            }
        }

        return this;
    }

    clear () {
        for ( const item of this.#shebangs ) {
            this.delete( item );
        }

        return this;
    }

    toJSON () {
        return this.#shebangs.size
            ? [ ...this.#shebangs ].sort()
            : undefined;
    }

    [ Symbol.iterator ] () {
        return this.#shebangs.values();
    }
}

class MimeTypeFilenames {
    #mimeType;
    #filenames = new Set();

    constructor ( mimeType ) {
        this.#mimeType = mimeType;
    }

    // properties
    get size () {
        return this.#filenames.size;
    }

    // public
    has ( filename ) {
        return this.#filenames.has( normalizeName( filename ) );
    }

    add ( filenames ) {
        if ( !Array.isArray( filenames ) ) filenames = [ filenames ];

        for ( let filename of filenames ) {
            filename = normalizeName( filename );

            if ( !this.#filenames.has( filename ) ) {
                this.#filenames.add( filename );

                this.#mimeType.mime?.filenames.add( this.#mimeType, filename );
            }
        }

        return this;
    }

    delete ( filenames ) {
        if ( !Array.isArray( filenames ) ) filenames = [ filenames ];

        for ( let filename of filenames ) {
            filename = normalizeName( filename );

            if ( this.#filenames.has( filename ) ) {
                this.#filenames.delete( filename );

                this.#mimeType.mime?.filenames.delete( filename );
            }
        }

        return this;
    }

    clear () {
        for ( const item of this.#filenames ) {
            this.delete( item );
        }

        return this;
    }

    toJSON () {
        return this.#filenames.size
            ? [ ...this.#filenames ].sort()
            : undefined;
    }

    [ Symbol.iterator ] () {
        return this.#filenames.values();
    }
}

class MimeTypeExtnames {
    #mimeType;
    #extnames = new Set();
    #default;

    constructor ( mimeType ) {
        this.#mimeType = mimeType;
    }

    // properties
    get size () {
        return this.#extnames.size;
    }

    get default () {
        if ( this.#default === undefined ) {
            this.#default = this.#extnames.values().next().value || null;
        }

        return this.#default;
    }

    // public
    has ( extname ) {
        return this.#extnames.has( normalizeExtname( extname ) );
    }

    add ( extnames ) {
        if ( !Array.isArray( extnames ) ) extnames = [ extnames ];

        for ( let extname of extnames ) {
            extname = normalizeExtname( extname );

            if ( !this.#extnames.has( extname ) ) {
                this.#extnames.add( extname );

                this.#mimeType.mime?.extnames.add( this.#mimeType, extname );
            }
        }

        return this;
    }

    delete ( extnames ) {
        if ( !Array.isArray( extnames ) ) extnames = [ extnames ];

        for ( let extname of extnames ) {
            extname = normalizeExtname( extname );

            if ( this.#extnames.has( extname ) ) {
                this.#extnames.delete( extname );

                this.#mimeType.mime?.extnames.delete( extname );

                if ( this.#default === extname ) {
                    this.#default = undefined;
                }
            }
        }

        return this;
    }

    clear () {
        for ( const item of this.#extnames ) {
            this.delete( item );
        }

        return this;
    }

    toJSON () {
        return this.#extnames.size
            ? [ ...this.#extnames ].sort()
            : undefined;
    }

    [ Symbol.iterator ] () {
        return this.#extnames.values();
    }
}

class MimeType {
    #mime;
    #essence;
    #type;
    #subtype;
    #compressible;
    #charset;
    #shebangs;
    #filenames;
    #extnames;

    constructor ( mime, essence, { compressible, charset } = {} ) {
        this.#mime = mime;
        this.#essence = essence;
        this.setCompressible( compressible );
        this.setCharset( charset );

        [ this.#type, this.#subtype ] = this.#essence.split( "/", 2 );

        this.#shebangs = new MimeTypeShebangs( this );
        this.#filenames = new MimeTypeFilenames( this );
        this.#extnames = new MimeTypeExtnames( this );
    }

    // static
    static new ( essence ) {
        if ( essence instanceof this ) {
            return essence;
        }

        return new this( null, essence );
    }

    static get compare () {
        return ( essence1, essence2 ) => this.new( essence1 ).compare( essence2 );
    }

    // properties
    get mime () {
        return this.#mime;
    }

    get essence () {
        return this.#essence;
    }

    get type () {
        return this.#type;
    }

    get subtype () {
        return this.#subtype;
    }

    get compressible () {
        return this.#compressible;
    }

    get charset () {
        return this.#charset;
    }

    get shebangs () {
        return this.#shebangs;
    }

    get filenames () {
        return this.#filenames;
    }

    get extnames () {
        return this.#extnames;
    }

    // public
    toString () {
        return this.#essence;
    }

    toJSON () {
        return {
            "essence": this.#essence,
            "compressible": this.#compressible || undefined,
            "charset": this.#charset || undefined,
            "shebangs": this.#shebangs.toJSON(),
            "filenames": this.#filenames.toJSON(),
            "extnames": this.#extnames.toJSON(),
        };
    }

    setCompressible ( value ) {
        this.#compressible = Boolean( value );

        return this;
    }

    setCharset ( charset ) {
        this.#charset = charset || null;

        return this;
    }

    delete () {
        this.mime?.delete( this.#essence );

        this.mime = null;

        return this;
    }

    compare ( essence ) {
        essence = this.constructor.new( essence );

        return this.type - essence.type || this.subtype - essence.subtype;
    }
}

class MimeShebangs {
    #mime;
    #shebangs = new Map();

    constructor ( mime ) {
        this.#mime = mime;
    }

    // properties
    get size () {
        return this.#shebangs.size;
    }

    // public
    has ( shebang ) {
        return this.#shebangs.has( normalizeName( shebang ) );
    }

    add ( essence, shebangs ) {
        const mimeType = this.#mime.get( essence );

        if ( !mimeType ) throw new Error( `MIME type not registered` );

        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            shebang = normalizeName( shebang );

            if ( !mimeType.shebangs.has( shebang ) ) {
                mimeType.shebangs.add( shebang );
            }
            else {
                const currentMimeType = this.#shebangs.get( shebang );

                if ( currentMimeType && currentMimeType.essence !== mimeType.essence ) {
                    currentMimeType.shebangs.delete( shebang );
                }

                this.#shebangs.set( shebang, mimeType );
            }
        }

        return this;
    }

    delete ( shebangs ) {
        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            shebang = normalizeName( shebang );

            const currentMimeType = this.#shebangs.get( shebang );

            if ( currentMimeType ) {
                this.#shebangs.delete( shebang );

                currentMimeType.shebangs.delete( shebang );
            }
        }

        return this;
    }

    clear () {
        for ( const item of this.#shebangs ) {
            this.delete( item );
        }

        return this;
    }

    toJSON () {
        const json = {};

        for ( const [ shebang, mimeType ] of this.#shebangs.entries() ) {
            json[ shebang ] = mimeType.essence;
        }

        return json;
    }

    [ Symbol.iterator ] () {
        return this.#shebangs.entries();
    }
}

class MimeFilenames {
    #mime;
    #filenames = new Map();

    constructor ( mime ) {
        this.#mime = mime;
    }

    // properties
    get size () {
        return this.#filenames.size;
    }

    // public
    has ( filename ) {
        return this.#filenames.has( normalizeName( filename ) );
    }

    get ( filename ) {
        return this.#filenames.get( normalizeName( filename ) );
    }

    add ( essence, filenames ) {
        const mimeType = this.#mime.get( essence );

        if ( !mimeType ) throw new Error( `MIME type not registered` );

        if ( !Array.isArray( filenames ) ) filenames = [ filenames ];

        for ( let filename of filenames ) {
            filename = normalizeName( filename );

            if ( !mimeType.filenames.has( filename ) ) {
                mimeType.filenames.add( filename );
            }
            else {
                const currentMimeType = this.#filenames.get( filename );

                if ( currentMimeType && currentMimeType.essence !== mimeType.essence ) {
                    currentMimeType.filenames.delete( filename );
                }

                this.#filenames.set( filename, mimeType );
            }
        }

        return this;
    }

    delete ( filenames ) {
        if ( !Array.isArray( filenames ) ) filenames = [ filenames ];

        for ( let filename of filenames ) {
            filename = normalizeName( filename );

            const currentMimeType = this.#filenames.get( filename );

            if ( currentMimeType ) {
                this.#filenames.delete( filename );

                currentMimeType.filenames.delete( filename );
            }
        }

        return this;
    }

    clear () {
        for ( const item of this.#filenames ) {
            this.delete( item );
        }

        return this;
    }

    toJSON () {
        const json = {};

        for ( const [ filename, mimeType ] of this.#filenames.entries() ) {
            json[ filename ] = mimeType.essence;
        }

        return json;
    }

    [ Symbol.iterator ] () {
        return this.#filenames.entries();
    }
}

class MimeExtnames {
    #mime;
    #extnames = new Map();

    constructor ( mime ) {
        this.#mime = mime;
    }

    // properties
    get size () {
        return this.#extnames.size;
    }

    // public
    has ( extname ) {
        return this.#extnames.has( normalizeExtname( extname ) );
    }

    get ( extname ) {
        return this.#extnames.get( normalizeExtname( extname ) );
    }

    add ( essence, extnames ) {
        const mimeType = this.#mime.get( essence );

        if ( !mimeType ) throw new Error( `MIME type not registered` );

        if ( !Array.isArray( extnames ) ) extnames = [ extnames ];

        for ( let extname of extnames ) {
            extname = normalizeExtname( extname );

            if ( !mimeType.extnames.has( extname ) ) {
                mimeType.extnames.add( extname );
            }
            else {
                const currentMimeType = this.#extnames.get( extname );

                if ( currentMimeType && currentMimeType.essence !== mimeType.essence ) {
                    currentMimeType.extnames.delete( extname );
                }

                this.#extnames.set( extname, mimeType );
            }
        }

        return this;
    }

    delete ( extnames ) {
        if ( !Array.isArray( extnames ) ) extnames = [ extnames ];

        for ( let extname of extnames ) {
            extname = normalizeExtname( extname );

            const currentMimeType = this.#extnames.get( extname );

            if ( currentMimeType ) {
                this.#extnames.delete( extname );

                currentMimeType.extnames.delete( extname );
            }
        }

        return this;
    }

    clear () {
        for ( const item of this.#extnames ) {
            this.delete( item );
        }

        return this;
    }

    toJSON () {
        const json = {};

        for ( const [ extname, mimeType ] of this.#extnames.entries() ) {
            json[ extname ] = mimeType.essence;
        }

        return json;
    }

    [ Symbol.iterator ] () {
        return this.#extnames.entries();
    }
}

export default class Mime {
    #types = {};
    #shebangs;
    #filenames;
    #extnames;

    constructor () {
        this.#shebangs = new MimeShebangs( this );
        this.#filenames = new MimeFilenames( this );
        this.#extnames = new MimeExtnames( this );
    }

    // properties
    get shebangs () {
        return this.#shebangs;
    }

    get filenames () {
        return this.#filenames;
    }

    get extnames () {
        return this.#extnames;
    }

    // public
    async find ( { filename, path, content } = {} ) {
        var mimeType;

        mimeType = this.findByFilename( filename || path );

        if ( !mimeType && ( path || content ) ) {
            mimeType = await this.findByShebang( { path, content } );
        }

        return mimeType;
    }

    findSync ( { filename, path, content } = {} ) {
        var mimeType;

        mimeType = this.findByFilename( filename || path );

        if ( !mimeType && ( path || content ) ) {
            mimeType = this.findByShebangSync( { path, content } );
        }

        return mimeType;
    }

    findByFilename ( filename ) {
        var mimeType;

        if ( filename ) {
            const basename = path.basename( filename );

            if ( basename ) {
                mimeType = this.#filenames.get( basename );

                if ( !mimeType ) {
                    const extname = path.extname( basename );

                    if ( extname ) {
                        mimeType = this.#extnames.get( extname );
                    }
                }
            }
        }

        return mimeType;
    }

    async findByShebang ( { path, content } = {} ) {
        if ( content ) {
            return this.#findByShebang( content );
        }
        else if ( path && ( await fs.promises.stat( path, { "throwIfNoEntry": false } ) ) ) {
            const fh = await fs.promises.open( path );

            content = Buffer.alloc( 50 );

            // read first 50 bytes
            await fh.read( content, 0, 50, 0 );

            await fh.close();

            content = content.toString( "latin1" );

            return this.#findByShebang( content );
        }
    }

    findByShebangSync ( { path, content } = {} ) {
        if ( content ) {
            return this.#findByShebang( content );
        }
        else if ( path && fs.existsSync( path ) ) {
            const fd = fs.openSync( path );

            content = Buffer.alloc( 50 );

            // read first 50 bytes
            fs.readSync( fd, content, 0, 50, 0 );

            fs.closeSync( fd );

            content = content.toString( "latin1" );

            return this.#findByShebang( content );
        }
    }

    has ( essence ) {
        return Boolean( this.get( essence ) );
    }

    get ( essence ) {
        if ( essence instanceof MimeType ) {
            essence = essence.essence;
        }

        return this.#types[ essence ];
    }

    add ( mimeTypes ) {
        if ( !Array.isArray( mimeTypes ) ) mimeTypes = [ mimeTypes ];

        for ( const { essence, compressible, charset, shebangs, filenames, extnames } of mimeTypes ) {
            let mimeType = this.get( essence );

            if ( mimeType ) {
                mimeType.delete();
            }

            mimeType = new MimeType( this, essence, {
                compressible,
                charset,
            } );

            this.#types[ mimeType.essence ] = mimeType;

            if ( shebangs ) {
                for ( const shebang of shebangs ) mimeType.shebangs.add( shebang );
            }

            if ( filenames ) {
                for ( const filename of filenames ) mimeType.filenames.add( filename );
            }

            if ( extnames ) {
                for ( const extname of extnames ) mimeType.extnames.add( extname );
            }
        }

        return this;
    }

    delete ( mimeTypes ) {
        if ( !Array.isArray( mimeTypes ) ) mimeTypes = [ mimeTypes ];

        for ( const type of mimeTypes ) {
            const mimeType = this.get( type );

            if ( mimeType ) {
                delete this.#types[ type ];

                mimeType.delete();

                for ( const value of type.shebangs ) {
                    delete this.#shebangs[ value ];
                }

                for ( const value of type.filenames ) {
                    delete this.#filenames[ value ];
                }

                for ( const value of type.extnames ) {
                    this.#extnames.delete( value );
                }
            }
        }

        return this;
    }

    clear () {
        for ( const type in this.#types ) {
            this.delete( type );
        }

        return this;
    }

    clone () {
        return new Mime().add( Object.values( this.#types ) );
    }

    toJSON () {
        return Object.values( this.#types ).sort( MimeType.compare );
    }

    * [ Symbol.iterator ] () {
        for ( const mimeType of Object.values( this.#types ) ) {
            yield mimeType;
        }
    }

    // private
    #findByShebang ( content ) {
        if ( content.startsWith( "#!" ) ) {
            for ( const [ shebang, mimeType ] of this.#shebangs ) {
                if ( content.startsWith( shebang ) ) return mimeType;
            }
        }
    }
}
