import tar1 from "@softvisio/utils/tar";
import File from "#lib/file";
import { objectIsPlain } from "#lib/utils";
import glob from "#lib/glob";

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
        files = glob( "**", {
            "cwd": options.cwd || process.cwd(),
            "directories": false,
        } );
    }

    return create( options, files, callback );
};

Object.defineProperties( tar.Pack.prototype, {
    "_add": {
        "value": tar.Pack.prototype.add,
    },
    "add": {
        "value": function ( file, { path, mode = 0o0644 } = {} ) {
            if ( file instanceof File || objectIsPlain( file ) ) {
                file = File.new( file );

                if ( !file.size ) throw Error( `File size is required` );

                const size = file.size;

                // create the header
                const h = new tar.Header( {
                    "path": path || file.path,
                    size,
                    mode,
                    "type": "File",
                    "mtime": new Date(),
                    "uid": process.getuid ? process.getuid() : null,
                    "gid": process.getgid ? process.getgid() : null,
                    "uname": process.env.USER,
                    "gname": process.env.GROUP,
                } );

                // create the ReadEntry
                const readEntry = new tar.ReadEntry( h );

                file.stream().pipe( readEntry );

                return this._add( readEntry );
            }
            else {
                return this._add( file );
            }
        },
    },
} );
