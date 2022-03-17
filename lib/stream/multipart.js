import stream from "#lib/stream";
import StreamCombined from "#lib/stream/combined";
import File from "#lib/file";
import uuidV4 from "#lib/uuid";

const TYPES = new Set( ["form-data", "alternative", "mixed"] );

export default class StreamMultipart extends StreamCombined {
    #boundary;
    #length;
    #type;
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

    get type () {
        return this.#type;
    }

    get length () {
        return this.#length;
    }

    // public
    append ( content, { type, size, name, filename, headers } = {} ) {
        var length = size || 0;

        // file
        if ( content instanceof File ) {
            length ||= content.size;
            type ||= content.type;
            filename ||= content.name;
            content = content.stream();
        }

        // string or buffer
        else if ( typeof content === "string" || Buffer.isBuffer( content ) ) {
            length ||= content.length;
            content = stream.Readable.from( content, { "objectMode": false } );
        }

        // multipart stream
        else if ( content instanceof StreamMultipart ) {
            length ||= content.length;
            type ||= content.type;
        }

        // invalid content
        else {
            throw Error( `Unsupported value type` );
        }

        var header = `--${this.boundary}\r\n`,
            hasType;

        // add custom headers
        if ( headers ) {
            for ( const name in headers ) {
                const id = name.toLowerCase();

                if ( id === "content-type" ) hasType = true;
                else if ( id === "content-length" ) continue;
                else if ( id === "content-disposition" ) continue;

                header += `${name}: ${headers[name]}\r\n`;
            }
        }

        // add Content-Length
        if ( length ) header += `Content-Length: ${length}\r\n`;

        // add Content-Type
        if ( !hasType && type ) {
            if ( filename ) header += `Content-Type: ${type}; name="${filename.replaceAll( `"`, `%22` )}"\r\n`;
            else header += `Content-Type: ${type}\r\n`;
        }

        // add Content-Disposition
        if ( name && filename ) {
            header += `Content-Disposition: form-data; name="${name.replaceAll( `"`, `%22` )}"; filename="${filename.replaceAll( `"`, `%22` )}"\r\n`;
        }
        else if ( name ) {
            header += `Content-Disposition: form-data; name="${name.replaceAll( `"`, `%22` )}"\r\n`;
        }
        else if ( filename ) {
            header += `Content-Disposition: attachment; filename="${filename.replaceAll( `"`, `%22` )}"\r\n`;
        }

        header += "\r\n";

        // track length
        if ( this.#length !== null ) {
            if ( !length ) {
                this.#length = null;
            }
            else {
                this.#length ||= this.#getLastChunk().length;

                this.#length += header.length + length + 2;
            }
        }

        super.append( header );
        super.append( content );
        super.append( isLast => {
            var chunk = "\r\n";

            if ( isLast ) chunk += this.#getLastChunk();

            return chunk;
        } );
    }

    // private
    #getLastChunk () {
        if ( !this.#lastChunk ) {
            this.#lastChunk = `--${this.boundary}--\r\n`;
        }

        return this.#lastChunk;
    }
}
