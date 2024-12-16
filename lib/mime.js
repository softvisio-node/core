import fs from "node:fs";
import path from "node:path";
import { readConfig } from "#lib/config";

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

    toJSON () {
        return [ ...this.#shebangs ];
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

    toJSON () {
        return [ ...this.#filenames ];
    }

    [ Symbol.iterator ] () {
        return this.#filenames.values();
    }
}

class MimeTypeExtnames {
    #mimeType;
    #extnames = new Set();

    constructor ( mimeType ) {
        this.#mimeType = mimeType;
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
            }
        }

        return this;
    }

    toJSON () {
        return [ ...this.#extnames ];
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
    #shebangs;
    #filenames;
    #extnames;

    constructor ( mime, type, { compressible } = {} ) {
        this.#mime = mime;
        this.#type = type;
        this.#compressible = Boolean( compressible );

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
            "compressible": this.#compressible,
            "shebangs": this.#shebangs.toJSON(),
            "filenames": this.#filenames.toJSON(),
            "extnames": this.#extnames.toJSON(),
        };
    }

    setCompressible ( value ) {
        this.#compressible = Boolean( value );

        return this;
    }

    delete () {
        this?.mime.deleteType( this.type );

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

    // public
    has ( shebang ) {
        return this.#shebangs.has( normalizeName( shebang ) );
    }

    add ( type, shebang ) {
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

        return this;
    }

    delete ( shebang ) {
        shebang = normalizeName( shebang );

        const currentMimeType = this.#shebangs.get( shebang );

        if ( currentMimeType ) {
            this.#shebangs.delete( shebang );

            currentMimeType.shebangs.delete( shebang );
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

    // public
    has ( filename ) {
        return this.#filenames.has( normalizeName( filename ) );
    }

    get ( filename ) {
        return this.#filenames.get( normalizeName( filename ) );
    }

    add ( type, filename ) {
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

        return this;
    }

    delete ( filename ) {
        filename = normalizeName( filename );

        const currentMimeType = this.#filenames.get( filename );

        if ( currentMimeType ) {
            this.#filenames.delete( filename );

            currentMimeType.filenames.delete( filename );
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

    // public
    has ( extname ) {
        return this.#extnames.has( normalizeExtname( extname ) );
    }

    get ( extname ) {
        return this.#extnames.get( normalizeExtname( extname ) );
    }

    add ( type, extname ) {
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

        return this;
    }

    delete ( extname ) {
        extname = normalizeExtname( extname );

        const currentMimeType = this.#extnames.get( extname );

        if ( currentMimeType ) {
            this.#extnames.delete( extname );

            currentMimeType.extnames.delete( extname );
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

class Mime {
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
    get ( type ) {
        if ( type instanceof MimeType ) {
            type = type.type;
        }

        return this.#types[ type ];
    }

    getByFilename ( filename, { useShebang, content } = {} ) {
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

        if ( !mimeType && useShebang ) {
            if ( content ) {
                mimeType = this.getByShebang( content );
            }
            else if ( filename && fs.existsSync( filename ) ) {
                const fd = fs.openSync( filename );

                content = Buffer.alloc( 50 );

                // read first 50 bytes
                fs.readSync( fd, content, 0, 50, 0 );

                content = content.toString( "latin1" );

                mimeType = this.getByShebang( content );
            }
        }

        return mimeType;
    }

    getByShebang ( content ) {
        if ( content.startsWith( "#!" ) ) {
            for ( const [ shebang, mimeType ] of this.#shebangs ) {
                if ( content.startsWith( shebang ) ) return mimeType;
            }
        }
    }

    addType ( { type, compressible, shebangs, filenames, extnames } ) {
        var mimeType = this.get( type );

        if ( mimeType ) {
            mimeType.delete();
        }

        mimeType = new MimeType( this, type, {
            compressible,
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

    deleteType ( type ) {
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

        return this;
    }

    clone () {
        const mime = new Mime();

        for ( const mimeType of Object.values( this.#types ) ) {
            mime.addType( mimeType );
        }

        return mime;
    }

    *[ Symbol.iterator ] () {
        for ( const mimeType of Object.values( this.#types ) ) {
            yield mimeType;
        }
    }
}

const mime = new Mime();

const types = readConfig( "mime-db/db.json", {
    "resolve": import.meta.url,
} );

for ( const type in types ) {
    mime.addType( {
        type,
        "compressible": types[ type ].compressible,
    } );

    if ( types[ type ].extensions ) {
        for ( const extname of types[ type ].extensions ) {
            if ( type.source === "iana" || !mime.extnames.has( extname ) ) {
                mime.extnames.add( type, extname );
            }
        }
    }
}

export default mime;
