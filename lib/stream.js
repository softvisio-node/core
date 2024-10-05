import fs from "node:fs";
import stream from "node:stream";
import Blob from "#lib/blob";
import env from "#lib/env";
import { TmpFile } from "#lib/tmp";

export default stream;
export * from "node:stream";

const DEFAULT_EOL = Buffer.from( "\n" );
const HTTP_HEADERS_EOL = Buffer.from( "\r\n\r\n" );
const DEFAULT_HTTP_HEADERS_MAX_LENGTH = 16_384;

stream.Readable.prototype.blackhole = async function () {

    // strem is destroyed
    if ( this.destroyed ) return;

    this.once( "error", e => {} );

    return new Promise( resolve => {
        this.on( "close", resolve );

        this.resume();
    } );
};

stream.Readable.prototype.buffer = async function ( { maxLength } = {} ) {

    // stream is destroyed
    if ( this.destroyed ) return;

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
            else if ( buffers.length === 1 ) resolve( buffers[ 0 ] );
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

    // stream is destroyed
    if ( this.destroyed ) return;

    const tmpFile = TmpFile.new( options );

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

    return new Blob( [ buffer ], { type } );
};

stream.Readable.prototype.text = async function ( { maxLength, encoding } = {} ) {
    const buffer = await this.buffer( { maxLength } );

    if ( !buffer ) return;

    return buffer.toString( encoding );
};

stream.Readable.prototype.json = async function ( { maxLength } = {} ) {
    const buffer = await this.buffer( { maxLength } );

    if ( !buffer.length ) return;

    try {
        return JSON.parse( buffer );
    }
    catch ( e ) {
        if ( env.isDevelopment ) {
            console.log( "Invalid JSON:\n", buffer );
        }

        throw e;
    }
};

stream.Readable.prototype.readHttpHeaders = async function ( { maxLength } = {} ) {
    maxLength = maxLength || DEFAULT_HTTP_HEADERS_MAX_LENGTH;

    return this.readLine( { "eol": HTTP_HEADERS_EOL, maxLength, "encoding": "latin1" } );
};

stream.Readable.prototype.readChunk = async function ( chunkLength, { encoding } = {} ) {

    // stream is destroyed, no more data can be read
    if ( this.destroyed ) return;

    // chunk is already buffered
    if ( this.readableLength >= chunkLength ) {
        return encoding
            ? this.read( chunkLength ).toString( encoding )
            : this.read( chunkLength );
    }

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

            // no data, unable to read chunk with the specified length
            if ( totalLength < chunkLength ) return resolve();

            let buffer;

            // combine buffers
            if ( buffers.length === 1 ) buffer = buffers[ 0 ];
            else buffer = Buffer.concat( buffers );

            resolve( encoding
                ? buffer.toString( encoding )
                : buffer );
        };

        readable = () => {

            // eof
            if ( !this.readableLength ) return end();

            const readSize = chunkLength - totalLength;

            const buffer = this.read( this.readableLength > readSize
                ? readSize
                : null );

            buffers.push( buffer );

            totalLength += buffer.length;

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
stream.Readable.prototype.readLine = async function ( { eol, maxLength, encoding, lastEolRequired } = {} ) {

    // stream is destroyed
    if ( this.destroyed ) return;

    eol = eol == null
        ? DEFAULT_EOL
        : Buffer.isBuffer( eol )
            ? eol
            : Buffer.from( eol, encoding );
    maxLength ||= Infinity;
    lastEolRequired ??= true;

    return new Promise( ( resolve, reject ) => {
        var error, end, readable, buffer, line;

        error = e => {
            this.off( "end", end );
            this.off( "readable", readable );

            reject( e );
        };

        end = () => {
            this.off( "error", error );
            this.off( "end", end );
            this.off( "readable", readable );

            // not found
            if ( line == null ) {
                if ( !lastEolRequired && buffer != null ) {
                    resolve( encoding
                        ? buffer.toString( encoding )
                        : buffer );
                }
                else {
                    resolve();
                }
            }

            // found
            else {
                resolve( encoding
                    ? line.toString( encoding )
                    : line );
            }
        };

        readable = () => {

            // eof
            if ( !this.readableLength ) return end();

            let start;

            if ( !buffer ) {
                const size = maxLength + eol.length;

                buffer = this.read( size > this.readableLength
                    ? this.readableLength
                    : size );
            }
            else {
                start = buffer.length - eol.length;

                const size = maxLength + eol.length - buffer.length;

                buffer = Buffer.concat( [ buffer, this.read( size > this.readableLength
                    ? this.readableLength
                    : size ) ] );
            }

            const idx = buffer.indexOf( eol, start );

            // not found
            if ( idx === -1 ) {
                if ( buffer.length >= maxLength + eol.length ) return this.destroy( `Length limit reached` );
            }

            // found
            else {
                if ( idx > maxLength ) return this.destroy( `Length limit reached` );

                line = buffer.subarray( 0, idx );

                if ( buffer.length > idx + eol.length ) this.unshift( buffer.subarray( idx + eol.length ) );

                return end();
            }

            // check eof
            this.read( 0 );
        };

        this.once( "error", error );
        this.on( "readable", readable );
        this.once( "end", end );
    } );
};
