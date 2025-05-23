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

    get type () {
        if ( this.#type == null ) {
            if ( this.name ) {
                this.#type = mime.findSync( {
                    "filename": this.name,
                } )?.essence;
            }

            this.#type ||= "";
        }

        return this.#type;
    }

    get size () {
        return this.#size;
    }

    // public
    setName ( value ) {
        this.#name = value;

        return this;
    }

    setType ( value ) {
        this.#type = value;

        return this;
    }

    setSize ( value ) {
        this.#size = value;

        return this;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {};

        if ( this.name ) spec.name = this.name;
        if ( this.type ) spec.type = this.type;
        if ( this.size ) spec.size = this.size;

        return "FileStream: " + inspect( spec );
    }
}
