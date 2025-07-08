import stream from "node:stream";
import mime from "#lib/mime";

export default class FileStream extends stream.PassThrough {
    #name;
    #type;
    #mimeType;
    #size;

    constructor ( readableStream, { name, type, size } = {} ) {
        super();

        if ( !( readableStream instanceof stream.Readable ) ) throw new Error( "Stream is not readable" );

        this.#name = name;
        this.#type = type;
        this.#size = size;

        stream.pipeline( readableStream, this, e => {} );
    }

    // properties
    get name () {
        return this.#name;
    }

    get type () {
        return this.#type ?? this.#getMimeType();
    }

    get size () {
        return this.#size;
    }

    // public
    setName ( value ) {
        this.#name = value;

        this.#mimeType = null;

        return this;
    }

    setType ( value ) {
        this.#type = value;

        return this;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {};

        if ( this.name ) spec.name = this.name;
        if ( this.type ) spec.type = this.type;
        if ( this.size ) spec.size = this.size;

        return "FileStream: " + inspect( spec );
    }

    // private
    #getMimeType () {
        if ( this.#mimeType == null ) {
            if ( this.name ) {
                this.#mimeType = mime.findSync( {
                    "filename": this.name,
                } )?.essence;
            }

            this.#mimeType ??= "";
        }

        return this.#mimeType;
    }
}
