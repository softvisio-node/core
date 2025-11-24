import Queue from "#lib/data-structures/queue";
import stream from "#lib/stream";

export default class StreamSubstreams extends stream.Transform {
    #transformCallback;
    #chunks = new Queue();
    #stream;
    #pendingRead = false;
    #readCallback = this.#read.bind( this );
    #errorListener = this.#onError.bind( this );
    #closeListener = this.#onClose.bind( this );

    constructor () {
        super( {
            "readableObjectMode": true,
        } );
    }

    // protected
    async _transform ( chunk, encoding, callback ) {
        this.#transformCallback = callback;

        await this._transformData( chunk );

        this.#processChunks();
    }

    // XXX delay, until stream closed
    _flush ( callback ) {
        this._pushData( null );

        this.#processChunks();

        callback();
    }

    _destroy ( error, callback ) {
        this.#destroy( error );

        callback( error );
    }

    async _transformData ( data ) {
        this._pushData( data );
    }

    _pushData ( data ) {
        this.#chunks.push( data ?? null );
    }

    _destroyData () {}

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

        this._destroyData();
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
