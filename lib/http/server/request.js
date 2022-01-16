import Events from "#lib/events";
import subnets from "#lib/ip/subnets";
import IpAddr from "#lib/ip/addr";
import fs from "fs";
import { createBrotliCompress, createGzip, createDeflate } from "zlib";
import mime from "#lib/mime";
import path from "path";
import { Readable } from "#lib/stream";
import Headers from "#lib/http/headers";

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

    #method;
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

        this.#res.onAborted( this.#onAborted.bind( this ) );
    }

    // props
    get isAborted () {
        return this.#isAborted;
    }

    get isResponded () {
        return this.#isResponded;
    }

    get remoteAddr () {
        this.#remoteAddr ??= new IpAddr( Buffer.from( this.#res.getProxiedRemoteAddressAsText() ).toString() || Buffer.from( this.#res.getRemoteAddressAsText() ).toString() );

        return this.#remoteAddr;
    }

    get realRemoteAddr () {
        if ( !this.#realRemoteAddr ) {
            const ip = this.#req.getHeader( "x-real-ip" );

            try {
                if ( ip ) this.#realRemoteAddr = new IpAddr( ip );
            }
            catch ( e ) {}

            if ( !this.#realRemoteAddr ) this.#realRemoteAddr = this.remoteAddr;

            const cloudflareConnectingIp = this.#req.getHeader( "cf-connecting-ip" );

            if ( cloudflareConnectingIp && subnets.contains( "cloudflare", this.#realRemoteAddr ) ) {
                try {
                    this.#realRemoteAddr = new IpAddr( cloudflareConnectingIp );
                }
                catch ( e ) {}
            }
        }

        return this.#realRemoteAddr;
    }

    get method () {
        if ( !this.#method ) this.#method = this.#req.getMethod();

        return this.#method;
    }

    get headers () {
        if ( !this.#headers ) {
            this.#headers = new Headers();

            this.#req.forEach( ( key, value ) => this.#headers.append( key, value, { "validate": false } ) );
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
            this.#stream = new Readable( { read () {} } );

            const handler = () => this.#stream.destroy( "Aborted" );

            this.once( "aborted", handler );

            this.#stream.once( "error", e => {} );

            this.#res.onData( ( arrayBuffer, isLast ) => {

                // make a copy of array buffer
                this.#stream.push( Buffer.concat( [Buffer.from( arrayBuffer )] ) );

                // eof
                if ( isLast ) {
                    this.off( "aborted", handler );

                    this.#stream.push( null );
                }
            } );
        }

        return this.#stream;
    }

    // public
    getHeader ( name ) {
        return this.#req.getHeader( name );
    }

    // body methods
    async buffer ( { maxLength } = {} ) {
        return this.stream.buffer( { maxLength } );
    }

    async json ( { maxLength } = {} ) {
        return this.stream.json( { maxLength } );
    }

    async text ( { maxLength, encoding } = {} ) {
        return this.stream.text( { maxLength, encoding } );
    }

    async arrayBuffer ( { maxLength } = {} ) {
        return this.stream.arrayBuffer( { maxLength } );
    }

    async blob ( { maxLength, type } = {} ) {
        return this.stream.blob( { maxLength, "type": type || this.getHeader( "content-type" ) } );
    }

    async tmpFile ( options ) {
        return this.stream.tmpFile( { "type": this.getHeader( "content-type" ), ...options } );
    }

    cork ( callback ) {
        this.#res.cork( callback );
    }

    writeHead ( status, headers ) {
        this.#isResponded = true;

        // resolve statusText
        if ( typeof status === "number" ) {
            status = result.getHttpStatus( status );
            status += " " + result.getStatusText( status );
        }

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

    end ( data, closeConnection ) {
        this.#isResponded = true;

        this.#res.end( data, closeConnection );

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

            headers["Content-Type"] = mimeType.type;
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
            const acceptEncoding = this.getHeader( "accept-encoding" );

            for ( const type in COMPRESSIONS ) {
                if ( acceptEncoding.indexOf( type ) > -1 ) {
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
        if ( this.#isAborted ) return;

        this.#isAborted = true;

        this.emit( "aborted" );
    }
}
