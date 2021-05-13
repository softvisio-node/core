import Stream from "stream";

export default class Blob {
    #buffer;
    #type;

    constructor ( buffer, options = {} ) {
        this.#type = options.type ?? "";

        this.data = buffer;
    }

    get data () {
        return this.#buffer;
    }

    set data ( value ) {
        if ( value == null ) {
            this.#buffer = null;
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

            this.#buffer = Buffer.concat( buffers );
        }
    }

    get type () {
        return this.#type;
    }

    get size () {
        return this.#buffer?.length;
    }

    // public

    async buffer () {
        return this.#buffer;
    }

    async arrayBuffer () {
        const buf = await this.buffer();

        if ( !buf ) return;

        return buf.buffer.slice( buf.byteOffset, buf.byteOffset + buf.byteLength );
    }

    async text () {
        const buf = await this.buffer();

        if ( !buf ) return;

        return buf.toString();
    }

    stream () {
        const readable = new Stream.Readable( { read () {} } );

        if ( this.#buffer ) readable.push( this.#buffer );

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
