import Events from "#lib/events";
import subnets from "#lib/db/subnets";
import IPAddr from "#lib/ip/addr";
import fs from "#lib/fs";
import { createBrotliCompress, createGzip, createDeflate } from "zlib";
import mime from "#lib/db/mime";
import path from "path";
import { Readable } from "stream";

const COMPRESSIONS = {
    "gzip": createGzip,
    "br": createBrotliCompress,
    "deflate": createDeflate,
};

export default class Request extends Events {
    #req;
    #res;

    #isAborted;
    #isResponded;
    #bodyUsed;

    #remoteAddr;
    #realRemoteAddr;
    #headers;
    #urlDecoded;
    #searchParams;
    #stream;

    constructor ( req, res ) {
        super();

        this.#req = req;
        this.#res = res;

        this.#res.onAborted( () => this.#onAborted.bind( this ) );
    }

    // props
    get isAborted () {
        return this.#isAborted;
    }

    get isResponded () {
        return this.#isResponded;
    }

    get bodyUsed () {
        return this.#bodyUsed;
    }

    get remoteAddr () {
        this.#remoteAddr ??= new IPAddr( Buffer.from( this.#res.getProxiedRemoteAddressAsText() ).toString() || Buffer.from( this.#res.getRemoteAddressAsText() ).toString() );

        return this.#remoteAddr;
    }

    get realRemoteAddr () {
        if ( !this.#realRemoteAddr ) {
            const ip = this.#req.getHeader( "x-real-ip" );

            try {
                if ( ip ) this.#realRemoteAddr = new IPAddr( ip );
            }
            catch ( e ) {}

            if ( !this.#realRemoteAddr ) this.#realRemoteAddr = this.remoteAddr;

            const cloudflareConnectingIp = this.#req.getHeader( "cf-connecting-ip" );

            if ( cloudflareConnectingIp && subnets.contains( "cloudflare", this.#realRemoteAddr ) ) {
                try {
                    this.#realRemoteAddr = new IPAddr( cloudflareConnectingIp );
                }
                catch ( e ) {}
            }
        }

        return this.#realRemoteAddr;
    }

    get method () {
        return this.#req.getMethod();
    }

    get headers () {
        if ( !this.#headers ) {
            this.#headers = {};

            this.#req.forEach( ( key, val ) => ( this.#headers[key] = val ) );
        }

        return this.#headers;
    }

    get url () {
        return this.#req.getUrl();
    }

    get urlDecoded () {
        this.#urlDecoded ??= path.normalize( decodeURI( this.url ) );

        return this.#urlDecoded;
    }

    get search () {
        return this.#req.getQuery();
    }

    get searchParams () {
        this.#searchParams ??= new URLSearchParams( this.search );

        return this.#searchParams;
    }

    get stream () {
        if ( !this.#stream ) {
            this.#bodyUsed = true;

            const stream = ( this.#stream = new Readable( {
                read () {
                    return true;
                },
            } ) );

            this.#res.onData( ( ab, isLast ) => {

                // uint and then slicing is bit faster than slice and then uint
                stream.push( new Uint8Array( ab.slice( ab.byteOffset, ab.byteLength ) ) );

                if ( isLast ) stream.push( null );
            } );
        }

        return this.#stream;
    }

    // public
    getHeader ( name ) {
        return this.#req.getHeader( name );
    }

    // body methods
    async buffer () {
        return new Promise( resolve => {
            const buffers = [];

            this.stream.on( "data", buffers.push.bind( buffers ) );

            this.stream.on( "end", () => {
                if ( buffers.length === 0 ) resolve( Buffer.allocUnsafe( 0 ) );
                else if ( buffers.length === 1 ) resolve( buffers[0] );
                else resolve( Buffer.concat( buffers ) );
            } );
        } );
    }

    async json () {
        return JSON.parse( await this.buffer() );
    }

    async text () {
        return await this.buffer().toString();
    }

    async arrayBuffer () {
        const buf = await this.buffer();

        return buf.buffer.slice( buf.byteOffset, buf.byteOffset + buf.byteLength );
    }

    // XXX https://github.com/sifrr/sifrr/tree/master/packages/server/sifrr-server
    async formData () {}

    cork ( callback ) {
        this.#res.cork( callback );
    }

    writeHead ( status, headers ) {
        this.#isResponded = true;

        // resolve status reason
        if ( typeof status === "number" ) status += " " + result.getReason( status );

        // write status
        this.#res.writeStatus( status );

        // write headers
        if ( headers ) this.writeHeaders( headers );

        return this;
    }

    writeHeader ( header, value ) {
        this.#isResponded = true;

        this.#res.writeHeader( header, value + "" );

        return this;
    }

    writeHeaders ( headers ) {
        this.#isResponded = true;

        for ( const header in headers ) {
            this.#res.writeHeader( header, headers[header] + "" );
        }

        return this;
    }

    write ( chunk ) {
        this.#isResponded = true;

        this.#res.write( chunk );

        return this;
    }

    end ( data ) {
        this.#isResponded = true;

        this.#res.end( data );

        return this;
    }

    tryEnd ( chunk, size ) {
        this.#isResponded = true;

        return this.#res.tryEnd( chunk, size );
    }

    close () {
        this.#res.close();

        return this;
    }

    getWriteOffset () {
        return this.#res.getWriteOffset();
    }

    onWritable ( callback ) {
        this.#res.onWritable( callback );

        return this;
    }

    // compress: bool, number
    // headers: {}
    // zlibOptions: https://nodejs.org/api/zlib.html#zlib_class_options
    // fallback: function( req ), in case if file not found
    sendFile ( path, options = {} ) {
        try {
            var stat = fs.statSync( path );
        }
        catch ( e ) {}

        // file not found or directory
        if ( !stat || !stat.isFile() ) {
            if ( options.fallback ) {
                options.fallback( this );
            }
            else {
                this.writeHead( 404 ).end();
            }

            return;
        }

        // prepare mtimeutc
        var { mtime, size } = stat;
        mtime.setMilliseconds( 0 );
        const mtimeutc = mtime.toUTCString();

        var reqHeaders = {
            "if-modified-since": this.getHeader( "if-modified-since" ),
            "range": this.getHeader( "range" ),
        };

        // return 304 if last-modified
        if ( reqHeaders["if-modified-since"] ) {
            if ( new Date( reqHeaders["if-modified-since"] ) >= mtime ) {
                this.writeHead( 304 ).end();

                return;
            }
        }

        var compress = !options.compress ? false : options.compress === true ? true : size >= options.compress,
            headers = options.headers ? { ...options.headers } : {};

        headers["Last-Modified"] = mtimeutc;

        // mime
        const mimeType = mime.getByFilename( path );
        if ( mimeType ) {
            if ( !mimeType.compressible ) compress = false;

            headers["Content-Type"] = mimeType["content-type"];
        }

        // write data
        let status,
            start = 0,
            end = size - 1;

        // range
        if ( reqHeaders.range ) {
            const parts = reqHeaders.range.replace( "bytes=", "" ).split( "-" );

            start = parseInt( parts[0], 10 );

            end = parts[1] ? parseInt( parts[1], 10 ) : end;

            headers["Accept-Ranges"] = "bytes";

            headers["Content-Range"] = `bytes ${start}-${end}/${size}`;

            size = end - start + 1;

            status = 206;
        }
        else {
            status = 200;
        }

        // for size = 0
        if ( end < 0 ) end = 0;

        // compression
        let compressed = false,
            compressor;

        if ( compress ) {
            const accept_encoding = this.getHeader( "accept-encoding" );

            for ( const type in COMPRESSIONS ) {
                if ( accept_encoding.indexOf( type ) > -1 ) {
                    compressed = type;

                    compressor = COMPRESSIONS[type]( options.zlibOptions );

                    headers["Content-Encoding"] = type;

                    break;
                }
            }
        }

        this.writeHead( status, headers );

        let readStream = fs.createReadStream( path, { start, end } );

        if ( compressor ) {
            readStream.pipe( compressor );
            readStream = compressor;
        }

        this.once( "aborted", () => readStream.destroy() );

        readStream.on( "error", e => {
            this.writeHead( 500 ).end();

            readStream.destroy();

            throw e;
        } );

        // compress, we don't know compressed file size, so can only use chunked transfer
        if ( compressed ) {
            readStream.on( "data", buffer => {
                this.write( buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength ) );
            } );

            readStream.on( "end", () => {
                this.end();
            } );
        }

        // regular
        else {
            readStream.on( "data", buffer => {
                const chunk = buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength ),
                    lastOffset = this.getWriteOffset();

                // first try
                const [ok, done] = this.tryEnd( chunk, size );

                // all data sent to client
                if ( done ) {
                    readStream.destroy();
                }
                else if ( !ok ) {

                    // pause because backpressure
                    readStream.pause();

                    // save unsent chunk for later
                    this.ab = chunk;

                    this.abOffset = lastOffset;

                    // register async handlers for drainage
                    this.onWritable( offset => {
                        const [ok, done] = this.tryEnd( this.ab.slice( offset - this.abOffset ), size );

                        if ( done ) {
                            readStream.destroy();
                        }
                        else if ( ok ) {
                            readStream.resume();
                        }

                        return ok;
                    } );
                }
            } );
        }
    }

    sendBuffer ( buffer ) {

        // ???
        // buffer = buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );

        const size = buffer.length;

        // all data sent
        if ( this.#res.tryEnd( buffer, size )[1] ) return;

        // back-pressure
        this.#res.onWritable( offset => this.#res.tryEnd( buffer.slice( offset ), size )[0] );
    }

    // private
    #onAborted () {
        if ( this.#onAborted ) return;

        this.#onAborted = true;

        this.emit( "aborted" );
    }
}
