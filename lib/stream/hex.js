import stream from "#lib/stream";

const DEFAULT_LINE_LENGTH = 76;

export class HexStreamEncoder extends stream.Transform {
    #lineLength;
    #eol;
    #line = "";

    constructor ( { wrap, lineLength, eol } = {} ) {
        super();

        this.#lineLength = wrap
            ? lineLength || DEFAULT_LINE_LENGTH
            : null;

        this.#eol = eol || "\n";
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        const data = this.#wrap( chunk.toString( "hex" ) );

        if ( data ) this.push( data, "ascii" );

        callback();
    }

    _flush ( callback ) {
        const data = this.#wrap( null, true );

        if ( data ) this.push( data, "ascii" );

        callback();
    }

    // private
    #wrap ( data, flush ) {
        if ( !this.#lineLength ) {
            return data;
        }

        data = this.#line + ( data || "" );
        this.#line = "";

        if ( !data ) {
            return;
        }
        else if ( data.length < this.#lineLength ) {
            if ( flush ) {
                return data + this.#eol;
            }
            else {
                this.#line = data;
            }
        }
        else if ( data.length === this.#lineLength ) {
            return data + this.#eol;
        }
        else {
            const lines = [];

            for ( let pos = 0; pos < data.length; pos += this.#lineLength ) {
                const line = data.slice( pos, pos + this.#lineLength );

                // store last incomplete line
                if ( !flush && line.length !== this.#lineLength ) {
                    this.#line = line;
                }
                else {
                    lines.push( line );
                }
            }

            return lines.join( this.#eol ) + this.#eol;
        }
    }
}

export class HexStreamDecoder extends stream.Transform {
    #buffer = "";

    constructor ( { base64url } = {} ) {
        super( {
            "decodeStrings": false,
            "defaultEncoding": "latin1",
        } );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( Buffer.isBuffer( chunk ) ) {
            chunk = chunk.toString( "latin1" );
        }

        chunk = ( this.#buffer + chunk ).replaceAll( /[\n\r]/gm, "" );
        this.#buffer = "";

        // min. 2 chars are required
        if ( chunk.length < 2 ) {
            this.#buffer = chunk;

            return callback();
        }

        const remaining = chunk.length % 2;

        if ( remaining ) {
            this.#buffer = chunk.slice( chunk.length - remaining );

            chunk = chunk.slice( 0, chunk.length - remaining );
        }

        try {
            const buffer = Buffer.from( chunk, "hex" );

            if ( !buffer.length ) throw new Error( "Hex data is not valid" );

            callback( null, buffer );
        }
        catch ( e ) {
            callback( e );
        }
    }

    _flush ( callback ) {
        if ( this.#buffer ) {
            callback( new Error( "Hex stream is incomplete" ) );
        }
        else {
            callback();
        }
    }
}
