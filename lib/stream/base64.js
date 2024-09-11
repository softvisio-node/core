import stream from "#lib/stream";

const DEFAULT_LINE_LENGTH = 76;

export class Encode extends stream.Transform {
    #lineLength;
    #curLine = "";
    #remainingBytes = false;

    constructor ( { wrap } = {} ) {
        super();

        this.#lineLength = wrap === true ? DEFAULT_LINE_LENGTH : wrap;
    }

    // protected
    _transform ( chunk, encoding, done ) {
        if ( encoding !== "buffer" ) {
            chunk = Buffer.from( chunk, encoding );
        }

        if ( !chunk || !chunk.length ) {
            return setImmediate( done );
        }

        if ( this.#remainingBytes && this.#remainingBytes.length ) {
            chunk = Buffer.concat( [ this.#remainingBytes, chunk ], this.#remainingBytes.length + chunk.length );
            this.#remainingBytes = false;
        }

        if ( chunk.length % 3 ) {
            this.#remainingBytes = chunk.subarray( chunk.length - ( chunk.length % 3 ) );
            chunk = chunk.subarray( 0, chunk.length - ( chunk.length % 3 ) );
        }
        else {
            this.#remainingBytes = false;
        }

        let b64 = this.#curLine + this.#encode( chunk );

        if ( this.#lineLength ) {
            b64 = this.#wrap( b64 );

            // remove last line as it is still most probably incomplete
            const lastLf = b64.lastIndexOf( "\n" );
            if ( lastLf < 0 ) {
                this.#curLine = b64;
                b64 = "";
            }
            else if ( lastLf === b64.length - 1 ) {
                this.#curLine = "";
            }
            else {
                this.#curLine = b64.substring( lastLf + 1 );
                b64 = b64.substring( 0, lastLf + 1 );
            }
        }

        if ( b64 ) {
            this.push( Buffer.from( b64, "ascii" ) );
        }

        setImmediate( done );
    }

    _flush ( done ) {
        if ( this.#remainingBytes && this.#remainingBytes.length ) {
            this.#curLine += this.#encode( this.#remainingBytes );
        }

        if ( this.#curLine ) {
            if ( this.#lineLength ) this.#curLine = this.#wrap( this.#curLine );

            this.push( this.#curLine, "ascii" );

            this.#curLine = "";
        }
        done();
    }

    // private
    #encode ( buffer ) {
        if ( typeof buffer === "string" ) {
            buffer = Buffer.from( buffer, "utf8" );
        }

        return buffer.toString( "base64" );
    }

    #wrap ( str ) {
        if ( !this.#lineLength || str.length <= this.#lineLength ) return str;

        const result = [],
            chunkLength = this.#lineLength * 1024,
            re = new RegExp( ".{" + this.#lineLength + "}", "g" );

        let pos = 0;

        while ( pos < str.length ) {
            const wrappedLines = str
                .substring( pos, pos + chunkLength )
                .replace( re, "$&\r\n" )
                .trim();

            result.push( wrappedLines );

            pos += chunkLength;
        }

        return result.join( "\r\n" ).trim();
    }
}
