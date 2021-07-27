import stream from "stream";

export default class Blob {
    #buffer;
    #type;

    constructor ( buffer, options = {} ) {
        this.#type = options.type ?? "";

        this.setBuffer( buffer );
    }

    get type () {
        return this.#type;
    }

    set type ( value ) {
        this.#type = value;
    }

    get size () {
        return this.#buffer?.length;
    }

    // public
    // this method is async to make it compatible with the web API Blob
    async buffer () {
        return this.#buffer;
    }

    // this method is async to make it compatible with the web API Blob
    async arrayBuffer () {
        const buffer = await this.buffer();

        if ( !buffer ) return;

        return buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );
    }

    // this method is async to make it compatible with the web API Blob
    async text ( options = {} ) {
        const buffer = await this.buffer();

        if ( !buffer ) return;

        return buffer.toString( options.encoding );
    }

    stream () {
        const readable = new stream.Readable( { read () {} } );

        // push buffer
        if ( this.#buffer ) readable.push( this.#buffer );

        // push EOF
        readable.push( null );

        return readable;
    }

    slice ( start, end, contentType ) {
        if ( !this.#buffer ) return;

        const size = this.size;

        let relativeStart, relativeEnd;

        if ( start === undefined ) {
            relativeStart = 0;
        }
        else if ( start < 0 ) {
            relativeStart = Math.max( size + start, 0 );
        }
        else {
            relativeStart = Math.min( start, size );
        }
        if ( end === undefined ) {
            relativeEnd = size;
        }
        else if ( end < 0 ) {
            relativeEnd = Math.max( size + end, 0 );
        }
        else {
            relativeEnd = Math.min( end, size );
        }

        const span = Math.max( relativeEnd - relativeStart, 0 );

        const buffer = this.#buffer;

        const slicedBuffer = buffer.slice( relativeStart, relativeStart + span );

        const blob = new Blob( slicedBuffer, { "type": contentType } );

        return blob;
    }

    getBuffer () {
        return this.#buffer;
    }

    setBuffer ( value ) {
        if ( value == null ) {
            this.#buffer = Buffer.alloc( 0 );
        }
        else if ( Buffer.isBuffer( value ) ) {
            this.#buffer = this.#coerceBuffer( value );
        }
        else {
            const buffers = [];

            if ( value ) {
                for ( const buf of value ) {
                    buffers.push( this.#coerceBuffer( buf ) );
                }
            }

            if ( !buffers.length ) this.#buffer = Buffer.alloc( 0 );
            else if ( buffers.length === 1 ) this.#buffer = buffers[0];
            else this.#buffer = Buffer.concat( buffers );
        }
    }

    // private
    #coerceBuffer ( buf ) {
        if ( !Buffer.isBuffer( buf ) ) {
            if ( ArrayBuffer.isView( buf ) ) {
                buf = Buffer.from( buf.buffer, buf.byteOffset, buf.byteLength );
            }
            else if ( buf instanceof ArrayBuffer ) {
                buf = Buffer.from( buf );
            }
            else if ( buf instanceof Blob ) {
                buf = buf.getBuffer();
            }
            else {
                buf = Buffer.from( typeof buf === "string" ? buf : String( buf ) );
            }
        }

        return buf;
    }
}
