import tar1 from "@softvisio/utils/tar";
import File from "#lib/file";
import { glob, globSync } from "#lib/glob";
import { objectIsPlain } from "#lib/utils";

const tar = { ...tar1 };

export default tar;

const create = tar.create;

tar.create = function ( options, files, callback ) {
    if ( typeof files === "function" ) callback = files;

    if ( Array.isArray( options ) ) {
        files = options;
        options = {};
    }

    if ( !files ) {

        // sync
        if ( options.sync ) {
            return create(
                options,
                globSync( "**", {
                    "cwd": options.cwd || process.cwd(),
                    "directories": false,
                } )
            );
        }

        // async
        else {
            return glob( "**", {
                "cwd": options.cwd || process.cwd(),
                "directories": false,
            } ).then( files => create( options, files, callback ) );
        }
    }
    else {
        return create( options, files, callback );
    }
};

Object.defineProperties( tar.Pack.prototype, {
    "__add": {
        "value": tar.Pack.prototype.add,
    },
    "add": {
        "value": function ( file, { path, mode = 0o0644 } = {} ) {
            if ( file instanceof File || objectIsPlain( file ) ) {
                file = File.new( file );

                if ( !file.size ) throw new Error( `File size is required` );

                const size = file.size;

                // create the header
                const h = new tar.Header( {
                    "path": path || file.path,
                    size,
                    mode,
                    "type": "File",
                    "mtime": new Date(),
                    "uid": process.getuid
                        ? process.getuid()
                        : null,
                    "gid": process.getgid
                        ? process.getgid()
                        : null,
                    "uname": process.env.USER,
                    "gname": process.env.GROUP,
                } );

                // create the ReadEntry
                const readEntry = new tar.ReadEntry( h );

                file.stream().pipe( readEntry );

                return this.__add( readEntry );
            }
            else {
                return this.__add( file );
            }
        },
    },
} );
