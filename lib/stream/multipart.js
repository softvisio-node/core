import stream from "#lib/stream";
import StreamCombined from "#lib/stream/combined";
import File from "#lib/file";
import uuidV4 from "#lib/uuid";
import Headers from "#lib/http/headers";

const TYPES = new Set( ["form-data", "alternative", "mixed"] );

export default class StreamMultipart extends StreamCombined {
    #boundary;
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

    get length () {
        return null;
    }

    get type () {
        return this.#type;
    }

    // public
    append ( content, { type, name, filename, headers, transform } = {} ) {
        headers = new Headers( headers );

        // file
        if ( content instanceof File ) {
            type ||= content.type;
            filename ||= content.name;
            content = content.stream();
        }

        // string or buffer
        else if ( typeof content === "string" || Buffer.isBuffer( content ) ) {
            content = stream.Readable.from( content, { "objectMode": false } );
        }

        // multipart stream
        else if ( content instanceof StreamMultipart ) {
            type ||= content.type;
        }

        // invalid content
        else if ( !( content instanceof stream.Readable ) ) {
            throw Error( `Unsupported value type` );
        }

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
        var header = `--${this.boundary}\r\n`;

        for ( const [hame, value] of headers.entries() ) {
            header += `${headers.translateHeader( hame )}: ${value}\r\n`;
        }

        header += "\r\n";

        super.append( header );

        if ( transform ) {
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
    }

    // private
    #getLastChunk () {
        if ( !this.#lastChunk ) {
            this.#lastChunk = `--${this.boundary}--\r\n`;
        }

        return this.#lastChunk;
    }
}
