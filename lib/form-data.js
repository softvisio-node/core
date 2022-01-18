import StreamCombined from "#lib/stream/combined";
import File from "#lib/file";

export default class FormData extends StreamCombined {
    #boundary;
    #length;
    #type;
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

    get type () {
        this.#type ??= `multipart/form-data; boundary=${this.boundary}`;

        return this.#type;
    }

    // public
    append ( name, value, headers ) {
        var length = 0,
            header = `--${this.boundary}\r\n`,
            type,
            hasType;

        if ( value instanceof File ) {
            length = value.size;

            header += `Content-Disposition: form-data; name="${name.replaceAll( `"`, `%22` )}"; filename="${value.name.replaceAll( `"`, `%22` )}"\r\n`;
            if ( value.size ) header += `Content-Length: ${value.size}"\r\n`;

            type = value.type;

            value = value.stream();
        }
        else if ( typeof value === "string" || Buffer.isBuffer( value ) ) {
            length = value.length;

            header += `Content-Disposition: form-data; name="${name.replaceAll( `"`, `%22` )}"\r\n`;
            header += `Content-Length: ${value.length}"\r\n`;
        }
        else {
            throw Error( `Unsupported value type` );
        }

        // add custom headers
        if ( headers ) {
            for ( const name in headers ) {
                const id = name.toLowerCase();

                if ( id === "content-type" ) hasType = true;
                else if ( id === "content-disposition" ) continue;

                header += `${name}: ${headers[name]}\r\n`;
            }
        }

        if ( !hasType && type ) {
            header += `Content-Type: ${type}\r\n`;
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
        super.append( value );
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
