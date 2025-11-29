import Queue from "#lib/data-structures/queue";
import stream from "#lib/stream";

export default class StreamSplitter extends stream.Transform {
    #eol;
    #eolBuffer;
    #buffer;
    #queue = new Queue();
    #stream;
    #callback;
    #pendingRead = false;
    #readCallback = this.#read.bind( this );
    #errorListener = this.#onError.bind( this );
    #closeListener = this.#onClose.bind( this );

    constructor ( { eol } = {} ) {
        super( {
            "readableObjectMode": true,
        } );

        this.#eol = eol;
        this.#eolBuffer = this.#eol
            ? Buffer.from( this.#eol )
            : null;
    }

    // properties
    get eol () {
        return this.#eol;
    }

    // protected
    // XXX optimize
    _transform ( chunk, encoding, callback ) {
        if ( !this.#buffer?.length ) {
            this.#buffer = chunk;
        }
        else {
            this.#buffer = Buffer.concat( [ this.#buffer, chunk ] );
        }

        this.#callback = callback;

        // XXX
        while ( true ) {
            const idx = this.#buffer.indexOf( this.#eolBuffer );

            if ( idx === -1 ) {
                break;
            }
            else {
                this.#queue.push( this.#buffer.subarray( 0, idx ) );
                this.#queue.push( null );

                this.#buffer = this.#buffer.subarray( idx + this.#eolBuffer.length );
            }
        }

        this.#processQueue();
    }

    // XXX called, when no more data to read
    _flush ( callback ) {
        this.#callback = callback;

        // XXX
        this.#queue.push( null );

        this.#processQueue();
    }

    _destroy ( error, callback ) {
        this.#destroy( error );

        callback( error );
    }

    // private
    // XXX clled from transform and on stream.close or stream need more data
    #processQueue ( { needData } = {} ) {

        // need more data
        if ( !this.#queue.length ) {
            this.#callCallback();
        }
        else {

            // create new stream
            if ( !this.#stream ) this.#createStream();

            if ( this.#pendingRead ) this.#read();
        }
    }

    #callCallback () {
        const callback = this.#callback;
        this.#callback = null;

        callback?.();
    }

    #read () {
        if ( this.#queue.length ) {
            this.#pendingRead = false;

            while ( this.#queue.length ) {
                const chunk = this.#queue.shift();

                this.#stream.push( chunk );

                if ( chunk == null ) break;
            }
        }
        else {
            this.#pendingRead = true;

            this.#processQueue();
        }
    }

    #onError ( e ) {}

    #onClose () {
        if ( this.#stream.readableAborted ) {
            this.destroy( this.#stream.errored || "Unexpected end of stream" );
        }
        else {
            this.#destroyStream();

            this.#processQueue();
        }
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

    #destroy ( error ) {
        this.#callback = null;
        this.#destroyStream( error );
    }
}
