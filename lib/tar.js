import tar from "tar";
import File from "#lib/file";
import { objectIsPlain } from "#lib/utils";

export default tar;

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
