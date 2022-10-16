import stream from "#lib/stream";
import StreamCombined from "#lib/stream/combined";
import Blob from "#lib/blob";
import File from "#lib/file";
import uuidV4 from "#lib/uuid";
import Headers from "#lib/http/headers";

const TYPES = new Set( ["form-data", "alternative", "mixed"] );

export default class StreamMultipart extends StreamCombined {
    #boundary;
    #type;
    #length;
    #lastChunk;

    constructor ( type ) {
        super();

        if ( !TYPES.has( type ) ) throw Error( `Type is invalid` );

        this.#boundary = "--------------------------" + uuidV4();

        this.#type = `multipart/${type}; boundary=${this.boundary}`;
    }

    // properties
    get boundary () {
        return this.#boundary;
    }

    get length () {
        return this.#length;
    }

    get type () {
        return this.#type;
    }

    // public
    append ( content, { type, name, filename, headers, transform } = {} ) {
        var length;

        // blob
        if ( content instanceof Blob ) {
            type ||= content.type;
            length = content.size;

            // file
            if ( content instanceof File ) filename ||= content.name;

            content = content.stream();
        }

        // string or buffer
        else if ( typeof content === "string" || Buffer.isBuffer( content ) ) {
            length = content.length;
            content = stream.Readable.from( content, { "objectMode": false } );
        }

        // multipart stream
        else if ( content instanceof StreamMultipart ) {
            length = content.length;
            type ||= content.type;
        }

        // invalid content
        else if ( !( content instanceof stream.Readable ) ) {
            throw Error( `Unsupported value type` );
        }

        headers = new Headers( headers );

        // add content-type
        if ( type ) {
            if ( filename ) {
                headers.set( "content-type", `${type}; name="${filename.replaceAll( `"`, `%22` )}"` );
            }
            else {
                headers.set( "content-type", type );
            }
        }

        // add content-disposition
        if ( name && filename ) {
            headers.set( "content-disposition", `form-data; name="${name.replaceAll( `"`, `%22` )}"; filename="${filename.replaceAll( `"`, `%22` )}"` );
        }
        else if ( name ) {
            headers.set( "content-disposition", `form-data; name="${name.replaceAll( `"`, `%22` )}"` );
        }
        else if ( filename ) {
            headers.set( "content-disposition", `attachment; filename="${filename.replaceAll( `"`, `%22` )}"` );
        }

        // compose header
        const header = `--${this.boundary}\r\n` + headers.string + "\r\n";

        super.append( header );

        if ( transform ) {
            length = null;

            super.append( stream.pipeline( content, transform, () => {} ) );
        }
        else {
            super.append( content );
        }

        super.append( isLast => {
            var chunk = "\r\n";

            if ( isLast ) chunk += this.#getLastChunk();

            return chunk;
        } );

        // track length
        if ( this.#length !== null ) {
            if ( length == null ) {
                this.#length = null;
            }
            else {
                this.#length ??= this.#getLastChunk().length;

                this.#length += header.length + length + 2;
            }
        }
    }

    // private
    #getLastChunk () {
        if ( !this.#lastChunk ) {
            this.#lastChunk = `--${this.boundary}--\r\n`;
        }

        return this.#lastChunk;
    }
}
