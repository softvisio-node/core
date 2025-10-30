import tar1 from "@softvisio/utils/tar";
import File from "#lib/file";
import { glob, globSync } from "#lib/glob";
import stream from "#lib/stream";
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

                const size = file.size;

                if ( !size ) throw new Error( "File size is required" );

                // create the header
                const header = new tar.Header( {
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
                const readEntry = new tar.ReadEntry( header );

                return this.__add( stream.pipeline( file.stream(), readEntry, e => {} ) );
            }
            else {
                return this.__add( file );
            }
        },
    },
} );

export class TarParserStream extends stream.Transform {
    #parser;

    constructor ( { filter } = {} ) {
        super( {
            "objectMode": true,
        } );

        this.#parser = new tar.Parser( {
            filter,
            "onReadEntry": this.#onReadEntry.bind( this ),
        } );
    }

    // protected
    async _transform ( chunk, encoding, callback ) {
        this.#parser.write( chunk );

        callback();
    }

    async _flush ( callback ) {
        this.#parser.end( () => {
            callback();
        } );
    }

    // private
    #onReadEntry ( readEntry ) {
        this.push( readEntry );
    }
}

export class TarPackStream extends stream.Transform {
    #pack;

    constructor ( { gzip, filter, onWriteEntry } = {} ) {
        super( {
            "objectMode": true,
        } );

        this.#pack = new tar.Pack( {
            gzip,
            filter,
            onWriteEntry,
        } );

        this.#pack.on( "data", this.#onData.bind( this ) );
    }

    // protected
    async _transform ( chunk, encoding, callback ) {
        this.#pack.write( chunk );

        callback();
    }

    _flush ( callback ) {
        this.#pack.end( () => {
            callback();
        } );
    }

    // private
    #onData ( chunk, encoding ) {
        this.push( chunk, encoding );
    }
}

tar.TarParserStream = TarParserStream;
tar.TarPackStream = TarPackStream;
