import path from "path";
import fs from "fs";
import { read as configRead } from "#lib/fs/config";

const ID_IDX = {};
const EXTNAME_IDX = {};
const SHEBANGS = {};

const DATA = configRead( "mime-db/db.json", { "resolve": import.meta.url } );

for ( const id in DATA ) {
    const type = id.split( "/" );

    const object = {
        id,
        "content-type": id,
        "type": type[0],
        "subtype": type[1],
        "compressible": !!DATA[id].compressible,
        "extnames": [],
        "source": DATA[id].source,
    };

    ID_IDX[id] = object;

    if ( DATA[id].extensions ) {
        DATA[id].extensions.forEach( extname => {
            extname = "." + extname;

            object.extnames.push( extname );

            EXTNAME_IDX[extname] = object;
        } );
    }
}

class MIME {
    registerContentType ( id, extnames, compressible, options = {} ) {
        if ( ID_IDX[id] && !options.force ) throw `MIME content type "${id}" is already registered.`;

        const type = id.split( "/" );

        const object = {
            id,
            "content-type": id,
            "type": type[0],
            "subtype": type[1],
            "compressible": !!compressible,
            "extnames": [],
            "source": "custom",
        };

        if ( extnames ) {
            if ( !Array.isArray( extnames ) ) extnames = [extnames];

            extnames = extnames.map( extname => {
                if ( extname.charAt( 0 ) !== "." ) extname = "." + extname;

                if ( EXTNAME_IDX[extname] && !options.force ) throw `Extension "${extname}" is already registered.`;

                return extname;
            } );

            object.extnames = extnames;

            extnames.forEach( extname => ( EXTNAME_IDX[extname] = object ) );
        }

        ID_IDX[id] = object;
    }

    registerExtname ( extname, id, options = {} ) {
        if ( extname.charAt( 0 ) !== "." ) extname = "." + extname;

        if ( EXTNAME_IDX[extname] && !options.force ) throw `Extension "${extname}" is already registered.`;

        const object = this.getById( id );

        if ( !object ) throw `MIME type "${id}" for extname "${extname}" is not registered.`;

        EXTNAME_IDX[extname] = object;

        object.extnames.push( extname );
    }

    registerShebang ( shebang, id, options = {} ) {
        if ( SHEBANGS[shebang] && !options.force ) throw `Shebang "${shebang}" is already registered.`;

        if ( !this.getById( id ) ) throw `MIME type "${id}" for shebang "${shebang}" is not registered.`;

        SHEBANGS[shebang] = id;
    }

    getById ( contentType ) {
        return ID_IDX[contentType];
    }

    getByContentType ( contentType ) {
        return this.getById( contentType );
    }

    // options:
    // useShebang
    // data
    getByFilename ( filename, options = {} ) {
        var type = EXTNAME_IDX[path.extname( filename ).toLowerCase()];

        if ( !type && options.useShebang ) {
            if ( options.data ) type = this.getByShebang( options.data );
            else if ( fs.existsSync( filename ) ) {
                const fd = fs.openSync( filename );

                const buf = Buffer.alloc( 50 );

                fs.readSync( fd, buf, 0, 50, 0 );

                type = this.getByShebang( buf.toString() );
            }
        }

        return type;
    }

    getByShebang = function ( content ) {

        // find shebang
        const match = content.match( /^#!(.+)/ );

        if ( !match ) return;

        const shebang = match[0].toLowerCase();

        for ( const name in SHEBANGS ) {
            if ( shebang.indexOf( name ) > -1 ) return this.getById( SHEBANGS[name] );
        }
    };
}

const mime = new MIME();

export default mime;

// REGISTER CUSTOM TYPES
mime.registerContentType( "application/vue", [".vue"], true );

mime.registerShebang( "bash", "application/x-sh" );
mime.registerShebang( "sh", "application/x-sh" );
mime.registerShebang( "node", "application/node" );
