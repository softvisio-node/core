import stream from "#lib/stream";

export default class StreamSplitter extends stream.Transform {
    #eol;
    #allowLast;
    #eolBuffer;
    #transformCallback;
    #buffer;
    #stream;
    #pendingRead = false;
    #readCallback = this.#read.bind( this );
    #errorListener = this.#onError.bind( this );
    #closeListener = this.#onClose.bind( this );

    constructor ( { eol, allowLast } = {} ) {
        super( {
            "readableObjectMode": true,
        } );

        this.#eol = eol;
        this.#eolBuffer = this.#eol
            ? Buffer.from( this.#eol )
            : null;

        this.#allowLast = Boolean( allowLast );
    }

    // properties
    get eol () {
        return this.#eol;
    }

    get allowLast () {
        return this.#allowLast;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( !this.#buffer?.length ) {
            this.#buffer = chunk;
        }
        else {
            this.#buffer = Buffer.concat( [ this.#buffer, chunk ] );
        }

        this.#transformCallback = callback;

        this.#processChunks();
    }

    // XXX called, when no more data to read
    _flush ( callback ) {
        if ( this.#buffer?.length ) {
            const chunk = this.#buffer;
            this.#buffer = null;

            this.#stream.push( chunk );
            this.#stream.push( null );
        }

        if ( this.#stream ) {
            this.#transformCallback = callback;
        }
        else {
            callback();
        }
    }

    _destroy ( error, callback ) {
        this.#destroy( error );

        callback( error );
    }

    // private
    #processChunks () {

        // need more data
        if ( !this.#buffer?.length ) {
            this.#callTransformCallback();
        }
        else {

            // create new stream
            if ( !this.#stream ) this.#createStream();

            if ( this.#pendingRead ) this.#read();
        }
    }

    #callTransformCallback () {
        const callback = this.#transformCallback;
        this.#transformCallback = null;

        callback?.();
    }

    #destroy ( error ) {
        this.#transformCallback = null;
        this.#destroyStream( error );
    }

    #createStream () {
        this.#destroyStream();

        this.#stream = new stream.Readable( {
            "read": this.#readCallback,
        } );

        this.#stream.setMaxListeners( this.#stream.getMaxListeners() + 1 );

        this.#stream.once( "error", this.#errorListener );
        this.#stream.once( "close", this.#closeListener );

        this.push( this.#stream );
    }

    // XXX optimize
    #read ( size ) {
        var chunk;

        if ( this.#buffer?.length ) {
            if ( this.#eolBuffer ) {

                // XXX optimize
                const idx = this.#buffer.indexOf( this.#eolBuffer );

                if ( idx > -1 ) {
                    chunk = this.#buffer.subarray( 0, idx );
                    this.#buffer = this.#buffer.subarray( idx + this.#eolBuffer.length );
                }
            }
            else {
                chunk = this.#buffer;
                this.#buffer = null;
            }
        }

        if ( chunk ) {
            this.#pendingRead = false;

            this.#stream.push( chunk );

            // EOF
            if ( this.#eolBuffer ) {
                this.#stream.push( null );
            }
        }

        // need more data
        else {
            this.#pendingRead = true;

            this.#callTransformCallback();
        }
    }

    #onError ( e ) {}

    #onClose () {
        if ( this.#stream.readableAborted ) {
            this.destroy( this.#stream.errored || "Unexpected end of stream" );
        }
        else {
            this.#destroyStream();

            this.#processChunks();
        }
    }

    #destroyStream ( error ) {
        if ( !this.#stream ) return;

        const stream = this.#stream;
        this.#stream = null;

        this.#pendingRead = false;

        // remove listeners
        stream.off( "error", this.#errorListener );
        stream.off( "close", this.#closeListener );

        stream.setMaxListeners( stream.getMaxListeners() - 1 );

        stream.destroy( error );
    }
}
