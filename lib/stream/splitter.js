import Queue from "#lib/data-structures/queue";
import StreamingSplitter from "#lib/data-structures/streaming-splitter";
import stream from "#lib/stream";

export default class StreamSplitter extends stream.Transform {
    #eol;
    #queue = new Queue();
    #stream;
    #callback;
    #pendingRead = false;
    #readCallback = this.#read.bind( this );
    #errorListener = this.#onError.bind( this );
    #closeListener = this.#onClose.bind( this );
    #streamingSplitter;

    constructor ( { eol } = {} ) {
        super( {
            "readableObjectMode": true,
        } );

        this.#eol = eol;

        this.#streamingSplitter = new StreamingSplitter( this.#eol );
    }

    // properties
    get eol () {
        return this.#eol;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        this.#callback = callback;

        const data = this.#streamingSplitter.push( chunk );

        if ( data.length ) {
            for ( const chunk of data ) this.#queue.push( chunk );
        }

        this.#processQueue();
    }

    _flush ( callback ) {
        this.#callback = callback;

        const data = this.#streamingSplitter.end();

        if ( data.length ) {
            for ( const chunk of data ) this.#queue.push( chunk );
        }

        this.#processQueue();
    }

    _destroy ( error, callback ) {
        this.#destroy( error );

        callback( error );
    }

    // private
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
        this.#streamingSplitter = null;

        this.#destroyStream( error );
    }
}
