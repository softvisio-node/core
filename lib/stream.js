import stream from "stream";
import StreamSearch from "#lib/stream/search";
import fs from "#lib/fs";
import Blob from "#lib/blob";

export { default } from "stream";
export * from "stream";

const DEFAULT_EOL = Buffer.from( "\n" );
const HTTP_HEADERS_EOL = Buffer.from( "\r\n\r\n" );
const DEFAULT_HTTP_HEADERS_MAX_LENGTH = 1024 * 64;

stream.Readable.prototype.blackhole = async function () {

    // strem is destroyed
    if ( this.destroyed ) {
        if ( this.readableLength ) this.read( this.readableLength );

        return;
    }

    this.once( "error", e => {} );

    return new Promise( resolve => {
        this.on( "close", resolve );

        this.resume();
    } );
};

stream.Readable.prototype.buffer = async function ( options = {} ) {

    // strem is destroyed
    if ( this.destroyed ) {
        if ( this.readableLength ) return this.read( this.readableLength );
        else return;
    }

    const buffers = [];

    var length = 0,
        error;

    this.once( "error", e => {
        error = true;
    } );

    this.on( "data", data => {
        length += data.length;

        if ( options.maxLength && length > options.maxLength ) {
            this.destroy( "Length limit exceeded" );
        }
        else {
            buffers.push( data );
        }
    } );

    return new Promise( resolve => {
        this.on( "close", () => {
            if ( error ) resolve();
            else if ( !buffers.length ) resolve( Buffer.alloc( 0 ) );
            else if ( buffers.length === 1 ) resolve( buffers[0] );
            else resolve( Buffer.concat( buffers ) );
        } );
    } );
};

stream.Readable.prototype.arrayBuffer = async function ( options ) {
    const buffer = await this.buffer( options );

    if ( !buffer ) return;

    return buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );
};

// XXX
stream.Readable.prototype.tmpFile = async function ( options = {} ) {

    // strem is destroyed and has no data in the internal buffers
    if ( this.destroyed && !this.readableLength ) return;

    const tmpFile = fs.TmpFile.new( options ),
        writeStream = fs.createWriteStream( tmpFile.path );

    var error;

    this.once( "error", e => {
        error = true;

        // destroy manually, because pipe doesn't handle errors
        writeStream.destroy();
    } );

    return new Promise( resolve => {
        if ( options.maxLength ) {
            let length = 0;

            this.on( "data", data => {
                length += data.length;

                if ( length > options.maxLength ) this.destroy( "Length limit exceeded" );
            } );
        }

        writeStream.once( "close", () => {
            if ( error ) resolve();
            else resolve( tmpFile );
        } );

        this.pipe( writeStream );
    } );
};

stream.Readable.prototype.blob = async function ( options = {} ) {
    const buffer = await this.buffer( options );

    if ( !buffer ) return;

    return new Blob( buffer, options );
};

stream.Readable.prototype.text = async function ( options = {} ) {
    const buffer = await this.buffer( options );

    if ( !buffer ) return;

    return buffer.toString( options.encoding );
};

stream.Readable.prototype.json = async function ( options = {} ) {
    const buffer = await this.buffer( options );

    if ( !buffer ) return;

    return JSON.parse( buffer );
};

// XXX
stream.Readable.prototype.readChunk = async function ( chunkLength, options = {} ) {

    // strem is destroyed and has no data in the internal buffers
    if ( this.destroyed && !this.readableLength ) return;

    // chunk is already buffered
    if ( this.readableLength >= chunkLength ) return options.encoding ? this.read( chunkLength ).toString( options.encoding ) : this.read( chunkLength );

    return new Promise( resolve => {
        var onReadable,
            buffers = [],
            totalLength = 0,
            found;

        const onEnd = () => {

            // remove events listeners
            this.off( "end", onEnd );
            this.off( "readable", onReadable );

            if ( found ) {
                const buf = Buffer.concat( buffers );

                resolve( options.encoding ? buf.toString( options.encoding ) : buf );
            }
            else {
                resolve( null );
            }
        };

        onReadable = () => {
            const readSize = chunkLength - totalLength;

            // max length reached or no more data
            if ( !readSize || !this.readableLength ) return onEnd();

            const buf = this.read( this.readableLength > readSize ? readSize : null );

            totalLength += buf.length;

            buffers.push( buf );

            if ( totalLength >= chunkLength ) {
                found = true;

                onEnd();
            }
        };

        // set events listeners
        this.once( "end", onEnd );
        this.on( "readable", onReadable );
    } );
};

// XXX
stream.Readable.prototype.readLine = async function ( options = {} ) {

    // strem is destroyed and has no data in the internal buffers
    if ( this.destroyed && !this.readableLength ) return;

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
        else {
            this.unshift( buf );
        }
    }

    if ( eol.length === 1 ) {
        buf = await readLine1( this, eol, maxLength, buf );
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

// XXX
stream.Readable.prototype.readHttpHeaders = async function ( options = {} ) {
    const maxLength = options.maxLength || DEFAULT_HTTP_HEADERS_MAX_LENGTH;

    const buf = await this.readLine( { "eol": HTTP_HEADERS_EOL, maxLength, "encoding": options.encoding ?? "binary" } );

    return buf;
};
