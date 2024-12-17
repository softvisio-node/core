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
    #type;
    #category;
    #subtype;
    #compressible;
    #charset;
    #shebangs;
    #filenames;
    #extnames;

    constructor ( mime, type, { compressible, charset } = {} ) {
        this.#mime = mime;
        this.#type = type;
        this.setCompressible( compressible );
        this.setCharset( charset );

        [ this.#category, this.#subtype ] = this.#type.split( "/", 2 );

        this.#shebangs = new MimeTypeShebangs( this );
        this.#filenames = new MimeTypeFilenames( this );
        this.#extnames = new MimeTypeExtnames( this );
    }

    // public
    get mime () {
        return this.#mime;
    }

    get type () {
        return this.#type;
    }

    get category () {
        return this.#category;
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
        return this.#type;
    }

    toJSON () {
        return {
            "type": this.#type,
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
        this?.mime.delete( this.type );

        this.mime = null;

        return this;
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

    add ( type, shebangs ) {
        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            shebang = normalizeName( shebang );

            const mimeType = this.#mime.get( type );

            if ( !mimeType ) throw new Error( `MIME type not registered` );

            if ( !mimeType.shebangs.has( shebang ) ) {
                mimeType.shebangs.add( shebang );
            }
            else {
                const currentMimeType = this.#shebangs.get( shebang );

                if ( currentMimeType && currentMimeType.type !== mimeType.type ) {
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
            json[ shebang ] = mimeType.type;
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

    add ( type, filenames ) {
        if ( !Array.isArray( filenames ) ) filenames = [ filenames ];

        for ( let filename of filenames ) {
            filename = normalizeName( filename );

            const mimeType = this.#mime.get( type );

            if ( !mimeType ) throw new Error( `MIME type not registered` );

            if ( !mimeType.filenames.has( filename ) ) {
                mimeType.filenames.add( filename );
            }
            else {
                const currentMimeType = this.#filenames.get( filename );

                if ( currentMimeType && currentMimeType.type !== mimeType.type ) {
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
            json[ filename ] = mimeType.type;
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

    add ( type, extnames ) {
        if ( !Array.isArray( extnames ) ) extnames = [ extnames ];

        for ( let extname of extnames ) {
            extname = normalizeExtname( extname );

            const mimeType = this.#mime.get( type );

            if ( !mimeType ) throw new Error( `MIME type not registered` );

            if ( !mimeType.extnames.has( extname ) ) {
                mimeType.extnames.add( extname );
            }
            else {
                const currentMimeType = this.#extnames.get( extname );

                if ( currentMimeType && currentMimeType.type !== mimeType.type ) {
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
            json[ extname ] = mimeType.type;
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

    has ( type ) {
        return Boolean( this.get( type ) );
    }

    get ( type ) {
        if ( type instanceof MimeType ) {
            type = type.type;
        }

        return this.#types[ type ];
    }

    add ( { type, compressible, charset, shebangs, filenames, extnames } ) {
        var mimeType = this.get( type );

        if ( mimeType ) {
            mimeType.delete();
        }

        mimeType = new MimeType( this, type, {
            compressible,
            charset,
        } );

        this.#types[ mimeType.type ] = mimeType;

        if ( shebangs ) {
            for ( const shebang of shebangs ) mimeType.shebangs.add( shebang );
        }

        if ( filenames ) {
            for ( const filename of filenames ) mimeType.filenames.add( filename );
        }

        if ( extnames ) {
            for ( const extname of extnames ) mimeType.extnames.add( extname );
        }

        return this;
    }

    addTypes ( types ) {
        if ( !Array.isArray( types ) ) types = [ types ];

        for ( const type of types ) this.add( type );

        return this;
    }

    delete ( types ) {
        if ( !Array.isArray( types ) ) types = [ types ];

        for ( const type of types ) {
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
        return new Mime().addTypes( Object.values( this.#types ) );
    }

    toJSON () {
        return Object.values( this.#types ).sort( ( a, b ) => {
            return a.category - b.category || a.subtype - b.subtype;
        } );
    }

    *[ Symbol.iterator ] () {
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
