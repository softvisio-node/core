/** summary: Stream patch.
 */

import Stream from "stream";
import StreamSearch from "streamsearch";

export default Stream;

const DEFAULT_EOL = Buffer.from( "\n" );
const HEADERS_EOL = Buffer.from( "\r\n" );
const DEFAULT_HEADERS_MAX_SIZE = 1024 * 64;

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
        const onReadable = () => {

            // no more data
            if ( !this.readableLength ) {

                // remove events listeners
                this.off( "readable", onReadable );

                resolve();
            }

            // required chunk length buffered
            else if ( this.readableLength >= chunkLength ) {

                // remove events listeners
                this.off( "readable", onReadable );

                const buf = this.read( chunkLength );

                resolve( options.encoding ? buf.toString( options.encoding ) : buf );
            }
        };

        // set events listeners
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
        maxBufSize = options.maxBufSize ?? Infinity;

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
        maxSize = options.maxSize || Infinity;

    var buf;

    if ( this.readableLength && this.readableLength >= eol.length ) {
        buf = this.read( this.readableLength >= maxSize ? maxSize : null );

        const idx = buf.indexOf( eol );

        // eol found
        if ( idx !== -1 ) {

            // unshift unmatched data back to the stream
            this.unshift( buf.slice( idx + eol.length ) );

            buf = buf.slice( 0, idx );

            return options.encoding ? buf.toString( options.encoding ) : buf;
        }

        // eol not found, max size reached
        else if ( buf.length >= maxSize ) {

            // unshift unmatched data back to the stream
            this.unshift( buf );

            return;
        }
    }

    return new Promise( resolve => {
        const streamSearch = new StreamSearch( eol ),
            buffers = [];

        var onReadable,
            onInfo,
            totalSize = 0,
            found;

        const onFinish = () => {

            // clear events listeners
            this.off( "readable", onReadable );
            streamSearch.off( "info", onInfo );

            if ( found ) {
                buf = Buffer.concat( buffers );

                resolve( options.encoding ? buf.toString( options.encoding ) : buf );
            }
            else {

                // unshift matched data back to the stream internal buffer
                if ( buffers.length ) this.unshift( Buffer.concat( buffers ) );

                resolve();
            }
        };

        onInfo = ( isMatch, buf, start, end ) => {

            // match found
            if ( isMatch ) {
                found = true;

                if ( buf ) {
                    buffers.push( buf.slice( start, end ) );

                    // unshift unmatched data
                    if ( buf.length > end + eol.length ) this.unshift( buf.slice( end + eol.length ) );

                    // stop read
                    onFinish();
                }
            }
            else {

                // unshift rest of the data to the stream internal buffer
                if ( found ) {
                    this.unshift( buf.slice( start, end ) );

                    onFinish();
                }

                // push unmatched data
                else {
                    buffers.push( buf.slice( start, end ) );
                }
            }
        };

        onReadable = () => {
            const readSize = maxSize - totalSize;

            // max size reached or no more data
            if ( !readSize || !this.readableLength ) return onFinish();

            buf = this.read( this.readableLength > readSize ? readSize : null );

            totalSize += buf.length;

            streamSearch.push( buf );
        };

        // set events listeners
        streamSearch.on( "info", onInfo );
        this.on( "readable", onReadable );

        // pre-init with the current buffer
        if ( buf ) streamSearch.push( buf );
    } );
};

// XXX
Stream.Readable.prototype.readHttpHeaders = async function ( options = {} ) {
    const maxSize = options.maxSize || DEFAULT_HEADERS_MAX_SIZE;

    const buf = await this.readLine( { "eol": HEADERS_EOL, maxSize } );

    return buf;
};
