import Events from "#lib/events";
import Busboy from "busboy";
import result from "#lib/result";

export default class FormDataDecoder extends Events {
    #headers;
    #stream;
    #busboy;
    #resolve;
    #finished = false;

    constructor ( headers, stream ) {
        super();

        this.#headers = headers;
        this.#stream = stream;
    }

    // properties
    get finished () {
        return this.#finished;
    }

    // public
    async decode ( options = {} ) {
        if ( this.#finished ) return;

        this.#busboy = new Busboy( {
            "defCharset": "binary",
            ...options,
            "headers": this.#headers,
        } );

        this.#headers = null;

        this.#busboy.on( "field", ( name, value, nameTruncated, valueTruncated, transferEncoding, type ) => {
            if ( this.#finished ) return;

            this.emit( "field", this, name, value, { type, transferEncoding, nameTruncated, valueTruncated } );
        } );

        this.#busboy.on( "file", ( name, stream, filename, transferEncoding, type ) => {
            if ( this.#finished ) return;

            this.emit( "file", this, name, stream, { type, transferEncoding, filename } );
        } );

        this.#busboy.on( "finish", this.#finish.bind( this ) );

        this.#stream.pipe( this.#busboy );

        return new Promise( resolve => {
            this.#resolve = resolve;
        } );
    }

    finish ( res ) {
        this.#finish( res || result( [500, `Terminated`] ) );
    }

    // private
    #finish ( res ) {
        if ( this.#finished ) return;

        this.#finished = true;

        this.#stream.unpipe( this.#busboy );

        this.#stream = null;
        this.#busboy = null;

        if ( this.#resolve ) {
            this.#resolve( res || result( 200 ) );

            this.#resolve = null;
        }
    }
}
