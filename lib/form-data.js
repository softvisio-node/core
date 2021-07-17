import FormData from "form-data";
import Events from "#lib/events";
import Busboy from "busboy";
import result from "#lib/result";

export default FormData;

export { FormData as FormData };

// XXX remove
FormData.decode = function decode ( stream, options = {} ) {
    const busboy = new Busboy( options );

    stream.pipe( busboy );

    return busboy;
};

export class FormDataDecoder extends Events {
    #terminated;
    #stream;
    #busboy;
    #resolve;

    // properties
    get terminated () {
        return this.#terminated;
    }

    // public
    async decode ( headers, stream, options = {} ) {
        if ( this.#terminated ) return;

        this.#stream = stream;

        this.#busboy = new Busboy( {
            "defCharset": "binary",
            ...options,
            headers,
        } );

        this.#busboy.on( "field", ( name, value, nameTruncated, valueTruncated, transferEncoding, type ) => {
            if ( this.#terminated ) return;

            this.emit( "field", name, value, { type, transferEncoding, nameTruncated, valueTruncated } );
        } );

        this.#busboy.on( "file", ( name, stream, filename, transferEncoding, type ) => {
            if ( this.#terminated ) return;

            this.emit( "file", name, stream, { type, transferEncoding, filename } );
        } );

        this.#busboy.on( "finish", this.#finish.bind( this ) );

        this.#stream.pipe( this.#busboy );

        return new Promise( resolve => {
            this.#resolve = resolve;
        } );
    }

    terminate ( res ) {
        this.#finish( res || result( [500, `Terminated`] ) );
    }

    // private
    #finish ( res ) {
        if ( this.#terminated ) return;

        this.#terminated = true;

        this.#stream.unpipe( this.#busboy );

        this.#stream = null;
        this.#busboy = null;

        if ( this.#resolve ) {
            this.#resolve( res || result( 200 ) );

            this.#resolve = null;
        }
    }
}
