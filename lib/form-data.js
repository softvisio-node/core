import StreamCombined from "#lib/stream/combined";
import File from "#lib/file";

export default class FormData extends StreamCombined {
    #boundary;
    #length = 0;
    #headers;
    #lastChunk;

    // properties
    get boundary () {
        if ( !this.#boundary ) {
            this.#boundary = "--------------------------";

            for ( let i = 0; i < 24; i++ ) {
                this.#boundary += Math.floor( Math.random() * 10 ).toString( 16 );
            }
        }

        return this.#boundary;
    }

    get length () {
        return this.#length;
    }

    get headers () {
        if ( !this.#headers ) {
            this.#headers = { "Content-Type": `multipart/form-data; boundary=${this.boundary}` };

            if ( this.#length ) this.#headers["Content-Length"] = this.length;
        }

        return this.#headers;
    }

    // public
    append ( name, value, headers ) {
        var length = 0,
            header = `--${this.boundary}\r\n`,
            type,
            hasType;

        if ( value instanceof File ) {
            length = value.size;

            header += `Content-Disposition: form-data; name="${name.replaceAll( `"`, `\\"` )}"; filename="${value.name.replaceAll( `"`, `\\"` )}"\r\n`;

            type = value.type;

            value = value.stream();
        }
        else if ( typeof value === "string" || Buffer.isBuffer( value ) ) {
            length = value.length;

            header += `Content-Disposition: form-data; name="${name.replaceAll( `"`, `\\"` )}"\r\n`;
        }
        else {
            throw Error( `Unsupported value type` );
        }

        // add custom headers
        if ( headers ) {
            for ( const name in headers ) {
                if ( name.toLowerCase() === "content-type" ) hasType = true;

                headers += `name: ${headers[name]}\r\n`;
            }
        }

        if ( !hasType && type ) {
            header += `Content-Type: ${type}\r\n`;
        }

        header += "\r\n";

        // track length
        if ( this.#length != null ) {
            if ( !length ) {
                this.#length = null;
            }
            else {
                this.#length ||= this.#getLastChunk().length;

                this.#length += header.length + length + 2;
            }
        }

        super.append( header );
        super.append( value );
        super.append( length => {
            var chunk = "\r\n";

            if ( !length ) chunk += this.#getLastChunk();

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
