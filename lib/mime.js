import path from "node:path";
import fs from "node:fs";
import { readConfig } from "#lib/config";

const TYPE_IDX = {};
const FILENAME_IDX = {};
const EXTNAME_IDX = {};
const SHEBANGS = {};

const SHEBANG_RE = /^#!(.+)/;

const DATA = readConfig( "mime-db/db.json", { "resolve": import.meta.url } );

// add default types
for ( const type in DATA ) {
    const category = type.split( "/" );

    const mimeType = {
        type,
        "category": category[ 0 ],
        "subtype": category[ 1 ],
        "compressible": !!DATA[ type ].compressible,
        "filenames": [],
        "extnames": [],
        "source": DATA[ type ].source,
    };

    TYPE_IDX[ type ] = mimeType;

    if ( DATA[ type ].extensions ) {
        for ( let extname of DATA[ type ].extensions ) {
            extname = "." + extname.toLowerCase();

            mimeType.extnames.push( extname );

            EXTNAME_IDX[ extname ] = mimeType;
        }
    }
}

class MIME {
    registerType ( type, extnames, compressible, options = {} ) {
        if ( TYPE_IDX[ type ] && !options.force ) throw `MIME content type "${ type }" is already registered.`;

        const category = type.split( "/" );

        const mimeType = {
            type,
            "category": category[ 0 ],
            "subtype": category[ 1 ],
            "compressible": !!compressible,
            "filenames": [],
            "extnames": [],
            "source": "custom",
        };

        if ( extnames ) {
            if ( !Array.isArray( extnames ) ) extnames = [ extnames ];

            // add extensions
            for ( let extname of extnames ) {
                if ( !extname.startsWith( "." ) ) extname = "." + extname;

                extname = extname.toLowerCase();

                if ( EXTNAME_IDX[ extname ] && !options.force ) throw `Extension "${ extname }" is already registered.`;

                mimeType.extnames.push( extname );
            }

            // register extensions
            for ( const extname of mimeType.extnames ) {
                EXTNAME_IDX[ extname ] = mimeType;
            }
        }

        TYPE_IDX[ type ] = mimeType;
    }

    registerExtname ( extname, type, options = {} ) {
        if ( !extname.startsWith( "." ) ) extname = "." + extname;

        extname = extname.toLowerCase();

        if ( EXTNAME_IDX[ extname ] && !options.force ) throw `Extension "${ extname }" is already registered.`;

        const mimeType = this.get( type );

        if ( !mimeType ) throw `MIME type "${ type }" for extname "${ extname }" is not registered.`;

        EXTNAME_IDX[ extname ] = mimeType;

        mimeType.extnames.push( extname );
    }

    registerFilename ( filename, type, options = {} ) {
        filename = filename.toLowerCase();

        if ( FILENAME_IDX[ filename ] && !options.force ) throw `File name "${ filename }" is already registered.`;

        const mimeType = this.get( type );

        if ( !mimeType ) throw `MIME type "${ type }" for file name "${ filename }" is not registered.`;

        FILENAME_IDX[ filename ] = mimeType;

        mimeType.filenames.push( filename );
    }

    registerShebang ( shebang, type, options = {} ) {
        if ( SHEBANGS[ shebang ] && !options.force ) throw `Shebang "${ shebang }" is already registered.`;

        if ( !this.get( type ) ) throw `MIME type "${ type }" for shebang "${ shebang }" is not registered.`;

        SHEBANGS[ shebang ] = type;
    }

    get ( type ) {
        return TYPE_IDX[ type ];
    }

    // options: useShebang, data
    getByFilename ( filename, options = {} ) {
        var mimeType;

        if ( filename ) {
            mimeType = FILENAME_IDX[ path.basename( filename ).toLowerCase() ];

            mimeType ??= EXTNAME_IDX[ path.extname( filename ).toLowerCase() ];
        }

        if ( !mimeType && options.useShebang ) {
            if ( options.data ) {
                mimeType = this.getByShebang( options.data );
            }
            else if ( filename && fs.existsSync( filename ) ) {
                const fd = fs.openSync( filename );

                const buf = Buffer.alloc( 50 );

                // read first 50 bytes
                fs.readSync( fd, buf, 0, 50, 0 );

                mimeType = this.getByShebang( buf.toString() );
            }
        }

        return mimeType;
    }

    getByShebang = function ( buffer ) {

        // find shebang
        const match = buffer.match( SHEBANG_RE );

        if ( !match ) return;

        const shebang = match[ 0 ].toLowerCase();

        for ( const name in SHEBANGS ) {
            if ( shebang.indexOf( name ) > -1 ) return this.get( SHEBANGS[ name ] );
        }
    };
}

const mime = new MIME();

export default mime;

// register custom types
mime.registerType( "application/vue", [ ".vue" ], true );

mime.registerShebang( "bash", "application/x-sh" );
mime.registerShebang( "sh", "application/x-sh" );
mime.registerShebang( "node", "application/node" );

mime.registerFilename( ".gitignore", "application/x-sh" );
mime.registerFilename( ".dockerignore", "application/x-sh" );
mime.registerFilename( ".lintignore", "application/x-sh" );

// mime.registerExtname ( ".dockerfile", "application/x-sh" )
// mime.registerFilename( "dockerfile", "application/x-sh" );
