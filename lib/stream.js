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
        var onEnd, onReadable;

        onEnd = () => {

            // remove events listeners
            this.off( "readable", onReadable );

            resolve( null );
        };

        onReadable = () => {

            // no more data
            if ( !this.readableLength ) {

                // remove events listeners
                this.off( "readable", onReadable );
                this.off( "end", onEnd );

                resolve( null );
            }

            // required chunk length buffered
            else if ( this.readableLength >= chunkLength ) {

                // remove events listeners
                this.off( "readable", onReadable );
                this.off( "end", onEnd );

                const buf = this.read( chunkLength );

                resolve( options.encoding ? buf.toString( options.encoding ) : buf );
            }
        };

        // set events listeners
        this.on( "readable", onReadable );
        this.once( "end", onEnd );
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
        maxSize = options.maxSize || Infinity;

    var buf;

    if ( this.readableLength && this.readableLength >= eol.length ) {
        buf = this.read( this.readableLength >= maxSize ? maxSize : null );

        const idx = buf.indexOf( eol );

        // eol found
        if ( idx !== -1 ) {

            // unshift unmatched data back to the stream
            if ( buf.length > idx + eol.length ) this.unshift( buf.slice( idx + eol.length ) );

            buf = buf.slice( 0, idx );

            return options.encoding ? buf.toString( options.encoding ) : buf;
        }

        // eol not found, max size reached
        else if ( buf.length >= maxSize ) {
            return null;
        }
    }

    return new Promise( resolve => {
        var streamSearch,
            buffers = [],
            onReadable,
            onInfo,
            totalSize = 0,
            currentPartLength = 0,
            found;

        if ( eol.length > 1 ) streamSearch = new StreamSearch( eol );

        const onFinish = () => {

            // clear events listeners
            this.off( "readable", onReadable );
            this.off( "end", onFinish );
            if ( streamSearch ) streamSearch.off( "info", onInfo );

            if ( found ) {
                buf = Buffer.concat( buffers );

                resolve( options.encoding ? buf.toString( options.encoding ) : buf );
            }
            else {
                resolve( null );
            }
        };

        onReadable = () => {
            const readSize = maxSize - totalSize;

            // max size reached or no more data
            if ( !readSize || !this.readableLength ) return onFinish();

            buf = this.read( this.readableLength > readSize ? readSize : null );

            totalSize += buf.length;

            if ( streamSearch ) {
                currentPartLength = buf.length;

                streamSearch.push( buf );
            }
            else {
                const idx = buf.indexOf( eol );

                // found
                if ( idx !== -1 ) {
                    found = true;

                    buffers.push( buf.slice( 0, idx ) );

                    // unshift unmatched data back to the stream
                    if ( buf.length > idx + eol.length ) this.unshift( buf.slice( idx + eol.length ) );

                    onFinish();
                }

                // not found
                else {
                    if ( totalSize >= maxSize ) onFinish();

                    buffers.push( buf );
                }
            }
        };

        // set events listeners
        if ( streamSearch ) {
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
                    else if ( currentPartLength === eol.length ) {
                        onFinish();
                    }
                }

                // not matched
                else {

                    // unshift rest of the data to the stream internal buffer
                    if ( found ) {
                        this.unshift( buf.slice( start, end ) );

                        onFinish();
                    }

                    // push unmatched data
                    else {
                        buffers.push( buf.slice( start, end ) );

                        // max size reached
                        if ( totalSize >= maxSize ) onFinish();
                    }
                }
            };

            streamSearch.on( "info", onInfo );
        }

        this.on( "readable", onReadable );
        this.once( "end", onFinish );

        // pre-init with the current buffer
        if ( buf && streamSearch ) {
            currentPartLength = buf.length;
            streamSearch.push( buf );
        }
    } );
};

// XXX
Stream.Readable.prototype.readHttpHeaders = async function ( options = {} ) {
    const maxSize = options.maxSize || DEFAULT_HEADERS_MAX_SIZE;

    const buf = await this.readLine( { "eol": HEADERS_EOL, maxSize } );

    return buf;
};
