import stream from "#lib/stream";
import tar from "#lib/tar";

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

export class TarUnpackStream extends stream.Transform {
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
