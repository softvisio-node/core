import Queue from "#lib/data-structures/queue";
import stream from "#lib/stream";

export default class StreamSplitter extends stream.Transform {
    #eol;
    #allowLast;
    #eolBuffer;
    #transformCallback;
    #chunks = new Queue();
    #stream;
    #pendingRead = false;
    #readCallback = this.#read.bind( this );
    #errorListener = this.#onError.bind( this );
    #closeListener = this.#onClose.bind( this );
    #buffer;

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
        this.#transformCallback = callback;

        let called;

        this._transformData( chunk, () => {
            if ( called ) return;
            called = true;

            this.#processChunks();
        } );
    }

    // XXX
    _flush ( callback ) {
        if ( this.#buffer?.length ) {
            if ( this.allowLast ) {
                this._pushData( this.#buffer );
                this.#buffer = null;

                this._pushData( null );

                callback();
            }
            else {
                callback( "Data is not complete" );
            }
        }
        else if ( this.#stream ) {
            if ( this.allowLast ) {

                // XXX close current stream if not closed
                this._pushData( null );
            }
            else {
                callback( "Data is not complete" );
            }
        }
    }

    _destroy ( error, callback ) {
        this.#destroy( error );

        callback( error );
    }

    // XXX
    _transformData ( chunk, callback ) {
        if ( !this.#buffer?.length ) {
            this.#buffer = chunk;
        }
        else {
            this.#buffer = Buffer.concat( this.#buffer, chunk );
        }

        if ( this.#eolBuffer ) {

            // XXX optimize
            while ( true ) {
                const idx = this.#buffer.indexOf( this.#eolBuffer );

                if ( idx === -1 ) {
                    break;
                }
                else {
                    this._pushData( this.#buffer.subarray( 0, idx ) );
                    this._pushData( null );

                    this.#buffer = this.#buffer.subarray( idx + this.#eolBuffer.length );
                }
            }
        }
        else {
            this._pushData( chunk );
        }

        callback();
    }

    _pushData ( data ) {
        this.#chunks.push( data ?? null );
    }

    // private
    #processChunks () {

        // need more data
        if ( !this.#chunks.length ) {
            this.#callTransformCallback();
        }
        else {

            // create new stream
            if ( !this.#stream ) {
                this.#createStream();
            }

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
        this.#chunks.clear();
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

    #read ( size ) {

        // has buffered data
        if ( this.#chunks.length ) {
            this.#pendingRead = false;

            this.#stream.push( this.#chunks.shift() );
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
