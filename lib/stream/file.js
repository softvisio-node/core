import mime from "#lib/mime";
import stream from "#lib/stream";

export default class FileStream extends stream.PassThrough {
    #name;
    #type;
    #size;

    constructor ( readableStream, { name, type, size } = {} ) {
        super();

        if ( !( readableStream instanceof stream.Readable ) ) throw new Error( "Stream is not readable" );

        this.#name = name;
        this.#type = type;
        this.#size = size;

        readableStream.pipe( this );
    }

    // properties
    get name () {
        return this.#name;
    }

    set name ( value ) {
        this.#name = value;
    }

    get type () {
        if ( this.#type === undefined ) {
            if ( this.name ) {
                this.#type = mime.findSync( {
                    "filename": this.name,
                } )?.essence;
            }

            this.#type ||= null;
        }

        return this.#type;
    }

    set type ( value ) {
        this.#type = value === undefined
            ? value
            : value || null;
    }

    get size () {
        return this.#size;
    }

    set size ( value ) {
        this.#size = value;
    }
}
