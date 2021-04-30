/** summary: Stream patch.
 */

import stream from "stream";

export default stream;

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
stream.Readable.prototype.readChunk = async function ( chunkLength, options = {} ) {

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
stream.Readable.prototype.readLine = async function ( options = {} ) {
    if ( options.eol == null ) options.eol = "\n";
    if ( options.maxBufSize == null ) options.maxBufSize = 1024 * 64;

    var buf, idx;

    if ( this.readableLength ) {
        buf = this.read();

        idx = buf.indexOf( options.eol );

        if ( idx !== -1 ) {
            this.unshift( buf.slice( idx + options.eol.length ) );

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

            idx = buf.indexOf( options.eol );

            // eol found
            if ( idx !== -1 ) {

                // remove events listeners
                this.off( "close", onClose );
                this.off( "readable", onReadable );

                if ( buf.length > idx + options.eol.length ) this.unshift( buf.slice( idx + options.eol.length ) );

                resolve( options.encoding ? buf.slice( 0, idx ).toString( options.encoding ) : buf.slice( 0, idx ) );
            }

            // eol not found, max internal buffer size reached
            else if ( buf.size >= options.maxBufSize ) {

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
