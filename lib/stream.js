import stream from "stream";
import StreamSearch from "#lib/stream/search";
import fs from "fs";
import Blob from "#lib/blob";
import { TmpFile } from "#lib/tmp";

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

stream.Readable.prototype.buffer = async function ( { maxLength } = {} ) {

    // stream is destroyed
    if ( this.destroyed ) {
        if ( this.readableLength ) {
            const buffer = this.read();

            if ( Buffer.isBuffer( buffer ) ) return buffer;

            return Buffer.from( buffer );
        }
        else return;
    }

    return new Promise( ( resolve, reject ) => {
        const buffers = [];

        var length = 0;

        this.once( "error", e => {
            reject( e );
        } );

        this.on( "data", data => {
            length += data.length;

            if ( maxLength && length > maxLength ) {
                this.destroy( "Length limit exceeded" );
            }
            else {
                buffers.push( data );
            }
        } );

        this.once( "end", () => {
            if ( !buffers.length ) resolve( Buffer.alloc( 0 ) );
            else if ( buffers.length === 1 ) resolve( buffers[0] );
            else resolve( Buffer.concat( buffers ) );
        } );
    } );
};

stream.Readable.prototype.arrayBuffer = async function ( { maxLength } = {} ) {
    const buffer = await this.buffer( { maxLength } );

    if ( !buffer ) return;

    return buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );
};

stream.Readable.prototype.tmpFile = async function ( options = {} ) {

    // strem is destroyed and has no data in the internal buffers
    if ( this.destroyed && !this.readableLength ) return;

    const tmpFile = TmpFile.new( options );

    if ( this.destroyed ) {
        fs.writeFileSync( tmpFile.path, this.read( this.readableLength ) );

        return tmpFile;
    }

    return new Promise( ( resolve, reject ) => {
        const writeStream = fs.createWriteStream( tmpFile.path );

        this.once( "error", e => {

            // destroy manually, because pipe doesn't handle errors
            writeStream.destroy();

            reject( e );
        } );

        if ( options.maxLength ) {
            let length = 0;

            this.on( "data", data => {
                length += data.length;

                if ( length > options.maxLength ) this.destroy( "Length limit exceeded" );
            } );
        }

        writeStream.once( "close", () => resolve( tmpFile ) );

        this.pipe( writeStream );
    } );
};

stream.Readable.prototype.blob = async function ( { maxLength, type } = {} ) {
    const buffer = await this.buffer( { maxLength } );

    if ( !buffer ) return;

    return new Blob( buffer, { type } );
};

stream.Readable.prototype.text = async function ( { maxLength, encoding } = {} ) {
    const buffer = await this.buffer( { maxLength } );

    if ( !buffer ) return;

    return buffer.toString( encoding );
};

stream.Readable.prototype.json = async function ( { maxLength } = {} ) {
    const buffer = await this.buffer( { maxLength } );

    if ( !buffer ) return;

    return JSON.parse( buffer );
};

stream.Readable.prototype.readHttpHeaders = async function ( { maxLength } = {} ) {
    maxLength = maxLength || DEFAULT_HTTP_HEADERS_MAX_LENGTH;

    return this.readLine( { "eol": HTTP_HEADERS_EOL, maxLength, "encoding": "binary" } );
};

stream.Readable.prototype.readChunk = async function ( chunkLength, { encoding } = {} ) {

    // chunk is already buffered
    if ( this.readableLength >= chunkLength ) return encoding ? this.read( chunkLength ).toString( encoding ) : this.read( chunkLength );

    // stream is destroyed, no more data can be read
    if ( this.destroyed ) return;

    return new Promise( ( resolve, reject ) => {
        var error,
            readable,
            buffers = [],
            totalLength = 0;

        error = e => {
            this.off( "end", end );
            this.off( "readable", readable );

            reject( e );
        };

        const end = () => {

            // remove events listeners
            this.off( "error", error );
            this.off( "end", end );
            this.off( "readable", readable );

            // no data, unable to read chunck with the specified length
            if ( !buffers.length ) return resolve();

            let buffer;

            // combine buffers
            if ( buffers.length === 1 ) buffer = buffers[0];
            else buffer = Buffer.concat( buffers );

            // data length < required chunk length
            if ( buffer.length < chunkLength ) {
                if ( !this.readableEnded ) this.unshift( buffer );

                // unable to read chunk with the specified length
                return resolve();
            }

            // data length > required chunk length
            else if ( buffer.length > chunkLength ) {
                if ( !this.readableEnded ) this.unshift( buffer.slice( chunkLength ) );

                buffer = buffer.slice( 0, chunkLength );
            }

            resolve( encoding ? buffer.toString( encoding ) : buffer );
        };

        readable = () => {

            // EOF
            if ( !this.readableLength ) return end();

            const readSize = chunkLength - totalLength;

            const buf = this.read( this.readableLength > readSize ? readSize : null );

            totalLength += buf.length;

            buffers.push( buf );

            // size reached
            if ( totalLength >= chunkLength ) end();
        };

        // set events listeners
        this.once( "error", error );
        this.once( "end", end );
        this.on( "readable", readable );
    } );
};

// maxLength - length without eol length
stream.Readable.prototype.readLine = async function ( { eol, maxLength, encoding } = {} ) {

    // strem is destroyed and has no data in the internal buffers
    if ( this.destroyed && !this.readableLength ) return;

    ( eol = eol == null ? DEFAULT_EOL : Buffer.isBuffer( eol ) ? eol : Buffer.from( eol, encoding ) ), ( maxLength ||= Infinity );

    var buf;

    if ( this.readableLength && this.readableLength >= eol.length ) {
        const readSize = maxLength + eol.length;

        buf = this.read( this.readableLength > readSize ? readSize : null );

        const idx = buf.indexOf( eol );

        // eol found
        if ( idx !== -1 ) {

            // unshift unmatched data back to the stream
            if ( buf.length > idx + eol.length ) this.unshift( buf.slice( idx + eol.length ) );

            buf = buf.slice( 0, idx );

            return encoding ? buf.toString( encoding ) : buf;
        }

        // eol not found
        else {

            // unshift data back to the stream
            this.unshift( buf );

            // max length reached, line can not be found
            if ( buf.length >= readSize ) return;
        }
    }

    // stream is desttroyed, no more data can be read
    if ( this.destroyed ) return;

    if ( eol.length === 1 ) {
        buf = await readLine1( this, eol, maxLength );
    }
    else {
        buf = await readLineSearch( this, eol, maxLength );
    }

    return buf == null ? buf : encoding ? buf.toString( encoding ) : buf;
};

// optimized for eol length = 1
// XXX handle error
async function readLine1 ( stream, eol, maxLength ) {
    return new Promise( ( resolve, reject ) => {
        var buffers = [],
            totalLength = 0,
            found,
            readable,
            error;

        const end = () => {

            // clear events listeners
            stream.off( "error", error );
            stream.off( "end", end );
            stream.off( "readable", readable );

            let buf;

            if ( !buffers.length ) buf = Buffer.alloc( 0 );
            else if ( buffers.length === 1 ) buf = buffers[0];
            else buf = Buffer.concat( buffers );

            // EOL found
            if ( found ) {
                resolve( buf );
            }

            // EOL not found
            else {

                // push all data back
                if ( buffers.length ) stream.unshift( buf );

                resolve();
            }
        };

        error = e => {
            stream.off( "end", end );
            stream.off( "readable", readable );

            reject( e );
        };

        readable = () => {

            // EOF
            if ( !stream.readableLength ) return end();

            const readSize = maxLength + eol.length - totalLength;

            const buf = stream.read( stream.readableLength > readSize ? readSize : null );

            totalLength += buf.length;

            const idx = buf.indexOf( eol );

            // found
            if ( idx !== -1 ) {
                found = true;

                // do not push empty buffer
                if ( idx ) buffers.push( buf.slice( 0, idx ) );

                // unshift unmatched data back to the stream
                if ( buf.length > idx + eol.length ) stream.unshift( buf.slice( idx + eol.length ) );

                end();
            }

            // not found
            else {
                buffers.push( buf );

                // max length reached
                if ( totalLength >= maxLength + eol.length ) end();
            }
        };

        // set events listeners
        stream.once( "error", error );
        stream.once( "end", end );
        stream.on( "readable", readable );
    } );
}

// XXX handle error
async function readLineSearch ( stream, eol, maxLength ) {
    return new Promise( resolve => {
        var streamSearch = new StreamSearch( eol, { "maxMatches": 1 } ),
            buffers = [],
            match,
            read,
            info,
            totalLength = 0;

        const finish = () => {

            // clear events listeners
            streamSearch.off( "info", info );
            stream.off( "close", finish );
            stream.off( "readable", read );

            if ( buffers.length === 1 ) stream.unshift( buffers[0] );
            else if ( buffers.length > 1 ) stream.unshift( Buffer.concat( buffers ) );

            if ( match ) {
                let buf;

                if ( !match.length ) buf = Buffer.alloc( 0 );
                else if ( match.length === 1 ) buf = match[0];
                else buf = Buffer.concat( match );

                resolve( buf );
            }
            else {
                resolve();
            }
        };

        read = () => {

            // EOF
            if ( !stream.readableLength ) return finish();

            const readSize = maxLength + eol.length - totalLength;

            const buf = stream.read( stream.readableLength > readSize ? readSize : null );

            totalLength += buf.length;

            const pos = streamSearch.push( buf );

            // EOL found
            if ( match ) {
                if ( pos ) buffers.push( buf.slice( pos ) );

                finish();
            }

            // max length reached
            else if ( totalLength >= maxLength + eol.length ) finish();
        };

        info = ( isMatch, buf, start, end ) => {

            // store data
            if ( buf && end - start > 0 ) buffers.push( buf.slice( start, end ) );

            // match found
            if ( isMatch ) {

                // copy matched buffers
                match = buffers;

                buffers = [];
            }
        };

        streamSearch.on( "info", info );

        stream.once( "close", finish );
        stream.on( "readable", read );
    } );
}
