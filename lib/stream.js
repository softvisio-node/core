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

stream.Readable.prototype.buffer = async function ( options = {} ) {

    // strem is destroyed
    if ( this.destroyed ) {
        if ( this.readableLength ) return this.read();
        else return Buffer.alloc( 0 );
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

stream.Readable.prototype.tmpFile = async function ( options = {} ) {

    // strem is destroyed and has no data in the internal buffers
    if ( this.destroyed && !this.readableLength ) return;

    const tmpFile = TmpFile.new( options );

    if ( this.destroyed ) {
        fs.writeFileSync( tmpFile.path, this.read( this.readableLength ) );

        return tmpFile;
    }

    const writeStream = fs.createWriteStream( tmpFile.path );

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

stream.Readable.prototype.readChunk = async function ( chunkLength, options = {} ) {

    // chunk is already buffered
    if ( this.readableLength >= chunkLength ) return options.encoding ? this.read( chunkLength ).toString( options.encoding ) : this.read( chunkLength );

    // stream is destroyed, no more data can be read
    if ( this.destroyed ) return;

    return new Promise( resolve => {
        var read,
            buffers = [],
            totalLength = 0;

        const finish = () => {

            // remove events listeners
            this.off( "close", finish );
            this.off( "readable", read );

            // no data
            if ( !buffers.length ) return resolve();

            let buf;

            // combine buffers
            if ( buffers.length === 1 ) buf = buffers[0];
            else buf = Buffer.concat( buffers );

            // data length < required chunk length
            if ( buf.length < chunkLength ) {
                this.unshift( buf );

                resolve();

                return;
            }

            // data length > required chunk length
            else if ( buf.length > chunkLength ) {
                this.unshift( buf.slice( chunkLength ) );

                buf = buf.slice( 0, chunkLength );
            }

            resolve( options.encoding ? buf.toString( options.encoding ) : buf );
        };

        read = () => {

            // EOF
            if ( !this.readableLength ) return finish();

            const readSize = chunkLength - totalLength;

            const buf = this.read( this.readableLength > readSize ? readSize : null );

            totalLength += buf.length;

            buffers.push( buf );

            // size reached
            if ( totalLength >= chunkLength ) finish();
        };

        // set events listeners
        this.once( "close", finish );
        this.on( "readable", read );
    } );
};

// maxLength - length without eol length
stream.Readable.prototype.readLine = async function ( options = {} ) {

    // strem is destroyed and has no data in the internal buffers
    if ( this.destroyed && !this.readableLength ) return;

    const eol = options.eol == null ? DEFAULT_EOL : Buffer.isBuffer( options.eol ) ? options.eol : Buffer.from( options.eol, options.encoding ),
        maxLength = options.maxLength || Infinity;

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

            return options.encoding ? buf.toString( options.encoding ) : buf;
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

    return buf == null ? buf : options.encoding ? buf.toString( options.encoding ) : buf;
};

// XXX
stream.Readable.prototype.readHttpHeaders = async function ( options = {} ) {
    const maxLength = options.maxLength || DEFAULT_HTTP_HEADERS_MAX_LENGTH;

    const buf = await this.readLine( { "eol": HTTP_HEADERS_EOL, maxLength, "encoding": options.encoding ?? "binary" } );

    return buf;
};

// optimized for eol length = 1
async function readLine1 ( stream, eol, maxLength ) {
    return new Promise( resolve => {
        var buffers = [],
            totalLength = 0,
            found,
            read;

        const finish = () => {

            // clear events listeners
            stream.off( "close", finish );
            stream.off( "readable", read );

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

        read = () => {

            // EOF
            if ( !stream.readableLength ) return finish();

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

                finish();
            }

            // not found
            else {
                buffers.push( buf );

                // max length reached
                if ( totalLength >= maxLength + eol.length ) finish();
            }
        };

        // set events listeners
        stream.once( "close", finish );
        stream.on( "readable", read );
    } );
}

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
