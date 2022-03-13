import { Transform } from "#lib/stream";

function encode ( buffer ) {
    if ( typeof buffer === "string" ) {
        buffer = Buffer.from( buffer, "utf-8" );
    }

    return buffer.toString( "base64" );
}

function wrap ( str, lineLength ) {
    str = ( str || "" ).toString();
    lineLength = lineLength || 76;

    if ( str.length <= lineLength ) {
        return str;
    }

    const result = [];
    let pos = 0;
    const chunkLength = lineLength * 1024;
    while ( pos < str.length ) {
        const wrappedLines = str
            .substr( pos, chunkLength )
            .replace( new RegExp( ".{" + lineLength + "}", "g" ), "$&\r\n" )
            .trim();
        result.push( wrappedLines );
        pos += chunkLength;
    }

    return result.join( "\r\n" ).trim();
}

export default class Encoder extends Transform {
    constructor ( options ) {
        super();

        // init Transform
        this.options = options || {};

        if ( this.options.lineLength !== false ) {
            this.options.lineLength = this.options.lineLength || 76;
        }

        this._curLine = "";
        this._remainingBytes = false;

        this.inputBytes = 0;
        this.outputBytes = 0;
    }

    _transform ( chunk, encoding, done ) {
        if ( encoding !== "buffer" ) {
            chunk = Buffer.from( chunk, encoding );
        }

        if ( !chunk || !chunk.length ) {
            return setImmediate( done );
        }

        this.inputBytes += chunk.length;

        if ( this._remainingBytes && this._remainingBytes.length ) {
            chunk = Buffer.concat( [this._remainingBytes, chunk], this._remainingBytes.length + chunk.length );
            this._remainingBytes = false;
        }

        if ( chunk.length % 3 ) {
            this._remainingBytes = chunk.slice( chunk.length - ( chunk.length % 3 ) );
            chunk = chunk.slice( 0, chunk.length - ( chunk.length % 3 ) );
        }
        else {
            this._remainingBytes = false;
        }

        let b64 = this._curLine + encode( chunk );

        if ( this.options.lineLength ) {
            b64 = wrap( b64, this.options.lineLength );

            // remove last line as it is still most probably incomplete
            const lastLf = b64.lastIndexOf( "\n" );
            if ( lastLf < 0 ) {
                this._curLine = b64;
                b64 = "";
            }
            else if ( lastLf === b64.length - 1 ) {
                this._curLine = "";
            }
            else {
                this._curLine = b64.substr( lastLf + 1 );
                b64 = b64.substr( 0, lastLf + 1 );
            }
        }

        if ( b64 ) {
            this.outputBytes += b64.length;
            this.push( Buffer.from( b64, "ascii" ) );
        }

        setImmediate( done );
    }

    _flush ( done ) {
        if ( this._remainingBytes && this._remainingBytes.length ) {
            this._curLine += encode( this._remainingBytes );
        }

        if ( this._curLine ) {
            this._curLine = wrap( this._curLine, this.options.lineLength );
            this.outputBytes += this._curLine.length;
            this.push( this._curLine, "ascii" );
            this._curLine = "";
        }
        done();
    }
}
