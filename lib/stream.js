/** summary: Stream patch.
 */

import Stream from "stream";
import StreamSearch from "streamsearch";

export default Stream;

const DEFAULT_EOL = Buffer.from( "\n" );
const DEFAULT_MAX_SIZE = 1024 * 64; // XXX Infinity

/** function: readChunk
 * summary: Read chunk of data with the specified length from the stream.
 * async: true
 * params:
 *   - name: stream
 *     required: true
 *     schema:
 *       type: Stream
 *   - name: chunkLength
 *     required: true
 *     schema:
 *       type: number
 *   - name: options
 *     schema:
 *       type: object
 *       properties:
 *         - encoding:
 *             type: string
 *             default: ~
 *       additionalProperties: false
 */
Stream.Readable.prototype.readChunk = async function ( chunkLength, options = {} ) {

    // chunk is already buffered
    if ( this.readableLength >= chunkLength ) return options.encoding ? this.read( chunkLength ).toString( options.encoding ) : this.read( chunkLength );

    return new Promise( resolve => {
        const onClose = function () {
            resolve();
        };

        const onReadable = function () {
            if ( this.readableLength >= chunkLength ) {

                // remove events listeners
                this.off( "close", onClose );
                this.off( "readable", onReadable );

                resolve( options.encoding ? this.read( chunkLength ).toString( options.encoding ) : this.read( chunkLength ) );
            }
        };

        // set events listeners
        this.once( "close", onClose );
        this.on( "readable", onReadable );
    } );
};

/** function: readLine
 * summary: Read line of data from the stream.
 * async: true
 * params:
 *   - name: stream
 *     required: true
 *     schema:
 *       type: Stream
 *   - name: options
 *     schema:
 *       type: object
 *       properties:
 *         eol:
 *           summary: Line separator.
 *           type: string
 *           default: |+
 *
 *         encoding:
 *           type: string
 *           default: ~
 *         maxBufSize:
 *           summary: Maximum internal buffer size.
 *           default: 65536
 *           type: number
 */
Stream.Readable.prototype.readLine = async function ( options = {} ) {
    const eol = options.eol == null ? DEFAULT_EOL : Buffer.isBuffer( options.eol ) ? options.eol : Buffer.from( options.eol, options.encoding ),
        maxBufSize = options.maxBufSize ?? DEFAULT_MAX_SIZE;

    var buf, idx;

    if ( this.readableLength ) {
        buf = this.read();

        idx = buf.indexOf( eol );

        if ( idx !== -1 ) {
            this.unshift( buf.slice( idx + eol.length ) );

            return options.encoding ? buf.slice( 0, idx ).toString( options.encoding ) : buf.slice( 0, idx );
        }
    }

    return new Promise( resolve => {
        const onClose = function () {
            resolve();
        };

        const onReadable = function () {
            buf = buf ? Buffer.concat( [buf, this.read()] ) : this.read();

            if ( buf == null ) return;

            idx = buf.indexOf( eol );

            // eol found
            if ( idx !== -1 ) {

                // remove events listeners
                this.off( "close", onClose );
                this.off( "readable", onReadable );

                if ( buf.length > idx + eol.length ) this.unshift( buf.slice( idx + eol.length ) );

                resolve( options.encoding ? buf.slice( 0, idx ).toString( options.encoding ) : buf.slice( 0, idx ) );
            }

            // eol not found, max internal buffer size reached
            else if ( buf.size >= maxBufSize ) {

                // remove events listeners
                this.off( "close", onClose );
                this.off( "readable", onReadable );

                this.unshift( buf );

                resolve();
            }
        };

        // set events listeners
        this.once( "close", onClose );
        this.on( "readable", onReadable );
    } );
};

Stream.Readable.prototype.readLine1 = async function ( options = {} ) {
    const eol = options.eol == null ? DEFAULT_EOL : Buffer.isBuffer( options.eol ) ? options.eol : Buffer.from( options.eol, options.encoding ),
        maxSize = options.maxSize ?? Infinity;

    var buf;

    if ( this.readableLength && this.readableLength >= eol.length ) {
        buf = this.read( maxSize );

        const idx = buf.indexOf( eol );

        // eol found
        if ( idx !== -1 ) {
            this.unshift( buf.slice( idx + eol.length ) );

            return options.encoding ? buf.slice( 0, idx ).toString( options.encoding ) : buf.slice( 0, idx );
        }

        // eol not found, max size reached
        else if ( buf.length >= maxSize ) {
            this.unshift( buf );

            return;
        }
    }

    return new Promise( resolve => {
        const buffers = [],
            streamSearch = new StreamSearch( eol );

        var onClose,
            onReadable,
            totalSize = 0,
            found;

        streamSearch.on( "info", ( isMatch, buf, start, end ) => {

            // XXX total size
            if ( !isMatch ) {
                if ( found ) this.unshift( buf.slice( start, end ) );
                else buffers.push( buf.slice( start, end ) );
            }
            else {
                found = true;

                if ( buf ) buffers.push( buf.slice( start, end ) );

                // stop read
                this.off( "readable", onReadable );
                this.off( "close", onClose );

                const res = Buffer.concat( buffers );

                resolve( options.encoding ? res.toString( options.encoding ) : res );
            }
        } );

        // XXX
        onClose = resolve;

        onReadable = () => streamSearch.push( this.read( maxSize - totalSize ) );

        // pre-init with the current buffer
        if ( buf ) streamSearch.push( buf );

        this.once( "close", onClose );
        this.on( "readable", onReadable );
    } );
};
