/** summary: Stream patch.
 */

import Stream from "stream";
import StreamSearch from "./stream/search.js";

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
        maxLength = options.maxLength || Infinity;

    var buf;

    if ( this.readableLength && this.readableLength >= eol.length ) {
        buf = this.read( this.readableLength >= maxLength ? maxLength : null );

        const idx = buf.indexOf( eol );

        // eol found
        if ( idx !== -1 ) {

            // unshift unmatched data back to the stream
            if ( buf.length > idx + eol.length ) this.unshift( buf.slice( idx + eol.length ) );

            buf = buf.slice( 0, idx );

            return options.encoding ? buf.toString( options.encoding ) : buf;
        }

        // eol not found, max size reached
        else if ( buf.length >= maxLength ) {
            return null;
        }
    }

    if ( eol.length === 1 ) {
        buf = await readLine1( this, eol, maxLength, buf );
    }
    else if ( options.concat ) {
        buf = await readLineConcat( this, eol, maxLength, buf );
    }
    else {
        buf = await readLineSearch( this, eol, maxLength, buf );
    }

    return buf == null ? buf : options.encoding ? buf.toString( options.encoding ) : buf;
};

// optimized for eol length = 1
async function readLine1 ( stream, eol, maxLength, buf ) {
    return new Promise( resolve => {
        var buffers = [],
            totalLength = 0,
            found,
            onReadable;

        if ( buf ) {
            buffers.push( buf );
            totalLength = buf.length;
        }

        const onEnd = () => {

            // clear events listeners
            stream.off( "end", onEnd );
            stream.off( "readable", onReadable );

            if ( found ) {
                if ( !buffers.length ) buf = Buffer.alloc( 0 );
                else if ( buffers.length === 1 ) buf = buffers[0];
                else buf = Buffer.concat( buffers );

                resolve( buf );
            }
            else {
                resolve( null );
            }
        };

        onReadable = () => {
            const readSize = maxLength - totalLength;

            // max size reached or no more data
            if ( !readSize || !stream.readableLength ) return onEnd();

            buf = stream.read( stream.readableLength > readSize ? readSize : null );

            totalLength += buf.length;

            const idx = buf.indexOf( eol );

            // found
            if ( idx !== -1 ) {
                found = true;

                buffers.push( buf.slice( 0, idx ) );

                // unshift unmatched data back to the stream
                if ( buf.length > idx + eol.length ) stream.unshift( buf.slice( idx + eol.length ) );

                onEnd();
            }

            // not found
            else {
                if ( totalLength >= maxLength ) onEnd();

                buffers.push( buf );
            }
        };

        // set events listeners
        stream.once( "end", onEnd );
        stream.on( "readable", onReadable );
    } );
}

async function readLineSearch ( stream, eol, maxLength, buf ) {
    return new Promise( resolve => {
        var streamSearch = new StreamSearch( eol, { "maxMatches": 1 } ),
            buffers = [],
            match,
            onReadable,
            onInfo,
            totalLength = 0,
            found;

        const onEnd = () => {

            // clear events listeners
            streamSearch.off( "info", onInfo );
            stream.off( "end", onEnd );
            stream.off( "readable", onReadable );

            if ( found ) {
                if ( !match.length ) buf = Buffer.alloc( 0 );
                else if ( match.length === 1 ) buf = match[0];
                else buf = Buffer.concat( match );

                resolve( buf );
            }
            else {
                resolve( null );
            }
        };

        onReadable = () => {
            const readSize = maxLength - totalLength;

            // max size reached or no more data
            if ( !readSize || !stream.readableLength ) return onEnd();

            buf = stream.read( stream.readableLength > readSize ? readSize : null );

            totalLength += buf.length;

            const pos = streamSearch.push( buf );

            if ( found ) {
                if ( pos ) buffers.push( buf.slice( pos ) );

                if ( buffers.length === 1 ) stream.unshift( buffers[0] );
                else if ( buffers.length > 1 ) stream.unshift( Buffer.concat( buffers ) );

                onEnd();
            }

            if ( totalLength >= maxLength ) onEnd();
        };

        onInfo = ( isMatch, buf, start, end ) => {

            // match found
            if ( isMatch ) {
                found = true;

                if ( buf && end - start > 0 ) buffers.push( buf.slice( start, end ) );

                match = buffers;

                buffers = [];
            }
            else {
                if ( buf && end - start > 0 ) buffers.push( buf.slice( start, end ) );
            }
        };

        streamSearch.on( "info", onInfo );

        // pre-init with the current buffer
        if ( buf ) {
            totalLength = buf.length;

            streamSearch.push( buf );
        }

        stream.once( "end", onEnd );
        stream.on( "readable", onReadable );
    } );
}

// XXX not effective, remove
async function readLineConcat ( stream, eol, maxLength, buf ) {
    return new Promise( resolve => {
        var buffer = buf || Buffer.alloc( 0 ),
            onReadable,
            totalLength = buffer.length,
            found;

        const onEnd = buf => {
            stream.off( "end", onEnd );
            stream.off( "readable", onReadable );

            if ( found ) {
                resolve( buffer );
            }
            else resolve( null );
        };

        onReadable = () => {
            const readSize = maxLength - totalLength;

            // max size reached or no more data
            if ( !readSize || !stream.readableLength ) return onEnd();

            buf = stream.read( stream.readableLength > readSize ? readSize : null );

            buffer = Buffer.concat( [buffer, buf] );

            totalLength = buffer.length;

            const idx = buffer.indexOf( eol );

            // found
            if ( idx !== -1 ) {
                found = true;

                // unshift unmatched data back to the stream
                if ( buffer.length > idx + eol.length ) stream.unshift( buffer.slice( idx + eol.length ) );

                buffer = buffer.slice( 0, idx );

                return onEnd();
            }

            // not found
            else {

                // max size reached
                if ( totalLength >= maxLength ) return onEnd();
            }
        };

        // set events listeners
        stream.once( "end", onEnd );
        stream.on( "readable", onReadable );
    } );
}

// XXX
Stream.Readable.prototype.readHttpHeaders = async function ( options = {} ) {
    const maxLength = options.maxLength || DEFAULT_HEADERS_MAX_SIZE;

    const buf = await this.readLine( { "eol": HEADERS_EOL, maxLength } );

    return buf;
};
