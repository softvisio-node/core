import stream from "#lib/stream";

const DEFAULT_LINE_LENGTH = 64;

export class Encode extends stream.Transform {
    #lineLength;
    #eol;
    #wrapRegExp;
    #line = "";

    constructor ( { wrap, lineLength, eol } = {} ) {
        super();

        this.#lineLength = wrap
            ? lineLength || DEFAULT_LINE_LENGTH
            : null;

        this.#eol = eol || "\n";

        if ( this.#lineLength ) {
            this.#wrapRegExp = new RegExp( "(.{1," + this.#lineLength + "})", "g" );
        }
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( !Buffer.isBuffer( chunk ) ) {
            try {
                chunk = Buffer.from( chunk, encoding );
            }
            catch ( e ) {
                return callback( e );
            }
        }

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

            for ( const match of data.matchAll( this.#wrapRegExp ) ) {
                const line = match[ 1 ];

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

export class Decode extends stream.Transform {
    #buffer = "";

    constructor ( { base64url } = {} ) {
        super();
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( Buffer.isBuffer( chunk ) ) {
            try {
                chunk = chunk.toString( "ascii" );
            }
            catch ( e ) {
                return callback( e );
            }
        }

        chunk = ( this.#buffer + chunk ).replaceAll( /(\r\n|\n|\r)/gm, "" );
        this.#buffer = "";

        const remaining = chunk.length % 2;

        if ( remaining ) {
            this.#buffer = chunk.slice( chunk.length - remaining );

            chunk = chunk.slice( 0, chunk.length - remaining );
        }

        try {
            callback( null, Buffer.from( chunk, "hex" ) );
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
