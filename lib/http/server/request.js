import Events from "#lib/events";
import subnets from "#lib/ip/subnets";
import IpAddress from "#lib/ip/address";
import fs from "fs";
import { createBrotliCompress, createGzip, createDeflate } from "zlib";
import mime from "#lib/mime";
import path from "path";
import { Readable } from "#lib/stream";
import Headers from "#lib/http/headers";
import StreamFormData from "#lib/stream/form-data";
import stream from "#lib/stream";
import File from "#lib/file";

const COMPRESSIONS = {
    "gzip": createGzip,
    "br": createBrotliCompress,
    "deflate": createDeflate,
};

export default class Request extends Events {
    #req;
    #res;

    #isAborted;
    #isEnded;

    #method;
    #remoteAddress;
    #realRemoteAddress;
    #headers;
    #urlDecoded;
    #searchParams;
    #stream;
    #formData;

    constructor ( req, res ) {
        super();

        this.#req = req;
        this.#res = res;

        this.#res.onAborted( this.#onAborted.bind( this ) );
    }

    // properties
    get isAborted () {
        return this.#isAborted;
    }

    get isEnded () {
        return this.#isEnded;
    }

    get remoteAddress () {
        this.#remoteAddress ??= new IpAddress( Buffer.from( this.#res.getProxiedRemoteAddressAsText() ).toString() || Buffer.from( this.#res.getRemoteAddressAsText() ).toString() );

        return this.#remoteAddress;
    }

    get realRemoteAddress () {
        if ( !this.#realRemoteAddress ) {
            this.#realRemoteAddress = this.remoteAddress;

            const xRealIp = this.#req.getHeader( "x-real-ip" );

            // x-real-ip header is trusted
            if ( xRealIp && subnets.get( "private" ).includes( this.remoteAddress ) ) {
                try {
                    this.#realRemoteAddress = new IpAddress( xRealIp );
                }
                catch ( e ) {}
            }

            const cloudflareConnectingIp = this.#req.getHeader( "cf-connecting-ip" );

            // cf-connecting-ip header is trusted
            if ( cloudflareConnectingIp && subnets.get( "cloudflare" ).includes( this.#realRemoteAddress ) ) {
                try {
                    this.#realRemoteAddress = new IpAddress( cloudflareConnectingIp );
                }
                catch ( e ) {}
            }
        }

        return this.#realRemoteAddress;
    }

    get method () {
        this.#method ??= this.#req.getMethod();

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
        if ( this.#urlDecoded == null ) {
            this.#urlDecoded = path.normalize( decodeURI( this.url ) );

            if ( process.platform === "win32" ) this.#urlDecoded = this.#urlDecoded.replaceAll( "\\", "/" );
        }

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

            const abortHandler = () => this.#stream.destroy( `HTTP request aborted` );

            this.once( "abort", abortHandler );

            this.#res.onData( ( arrayBuffer, isLast ) => {

                // make a copy of array buffer
                this.#stream.push( Buffer.concat( [Buffer.from( arrayBuffer )] ) );

                // eof
                if ( isLast ) {
                    this.off( "abort", abortHandler );

                    this.#stream.push( null );
                }
            } );
        }

        return this.#stream;
    }

    get formData () {
        if ( !this.#formData ) {
            this.#formData = new StreamFormData( this.headers.contentType?.boundary );

            stream.pipeline( this.stream, this.#formData, () => {} );
        }

        return this.#formData;
    }

    // public
    // XXX remove
    getHeader ( name ) {
        return this.#req.getHeader( name );
    }

    upgrade ( context, { data, key, protocol, extensions } = {} ) {
        key ??= this.headers.get( "sec-websocket-key" );
        protocol ??= this.headers.get( "sec-websocket-protocol" );
        extensions ??= this.headers.get( "sec-websocket-extensions" );

        this.#res.upgrade( { data }, key, protocol, extensions, context );
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

    // XXX normalize headers
    // XXX compression
    // XXX handler for file not found
    // XXX process content length = 0
    async end1 ( { status = 200, headers, body, compress, zlibOptions, close } = {} ) {
        if ( typeof status !== "number" ) throw Error( `Status must be a number` );

        if ( this.#isAborted || this.#isEnded ) return;

        this.#isEnded = true;

        // prepare headers
        headers = new Headers( headers );

        var contentType,
            contentLength,
            range = this.headers.range,
            ifModifiedSince = this.headers.get( "if-modified-since" );

        // cache control
        if ( ifModifiedSince ) {
            let lastModified = headers.has( "last-modified" );

            if ( lastModified ) {
                lastModified = new Date( lastModified );
            }
            else if ( body instanceof File ) {
                lastModified = body.lastModifiedDate;

                if ( lastModified ) headers.set( "last-modified", lastModified.toUTCString() );
            }

            if ( lastModified ) {
                ifModifiedSince = new Date( ifModifiedSince );

                if ( lastModified <= ifModifiedSince ) {
                    status = 304;

                    body = null;
                }
            }
        }

        // preparebody
        if ( body ) {

            // file
            if ( body instanceof File ) {
                contentType = body.type;

                if ( body.isStreamRangeSupported ) headers.set( "accept-ranges", "bytes" );

                if ( body.lastModifiedDate && !headers.has( "last-modified" ) ) headers.set( "last-modified", body.lastModifiedDate.toUTCString() );

                if ( range ) {
                    if ( range.unit !== "bytes" || !body.isStreamRangeSupported || range.end > body.size ) {
                        status = 416; // Range Not Satisfiable

                        body = null;
                    }
                    else {
                        status = 206; // Partial Content

                        contentLength = range.end - range.start;

                        headers.set( "content-range", `bytes ${range.start}-${range.end}/${body.size}` );

                        body = body.stream( { "start": range.start, "end": range.end } );
                    }
                }
                else {
                    contentLength = body.size;

                    body = body.stream();
                }
            }

            // blob
            else if ( body instanceof Blob ) {
                contentType = body.type;

                headers.set( "accept-ranges", "bytes" );

                if ( range ) {
                    if ( range.unit !== "bytes" || range.end > body.size ) {
                        status = 416; // Range Not Satisfiable

                        body = null;
                    }
                    else {
                        status = 206; // Partial Content

                        headers.set( "content-range", `bytes ${range.start}-${range.end}/${body.size}` );

                        body = body.slice( range.start, range.end );
                    }
                }
                else {
                    body = await body.arrayBuffer();
                }
            }

            // stream
            else if ( body instanceof stream.Readable ) {
                if ( range ) {
                    status = 416; // Range Not Satisfiable

                    body = null;
                }
            }

            // string, buffer, array buffer
            else {
                headers.set( "accept-ranges", "bytes" );

                if ( range ) {
                    if ( range.unit !== "bytes" || range.end > body.length ) {
                        status = 416; // Range Not Satisfiable

                        body = null;
                    }
                    else {
                        status = 206; // Partial Content

                        headers.set( "content-range", `bytes ${range.start}-${range.end}/${body.length}` );

                        body = body.slice( range.start, range.end );
                    }
                }
            }
        }

        var writeBody = !!body;

        // do not write body for "head" method
        if ( this.method === "head" ) writeBody = false;

        // do not write body
        if ( status === 204 || status === 304 ) writeBody = false;

        // prepare status
        status = result.getHttpStatus( status );
        status += " " + result.getStatusText( status );

        // write status
        this.#res.writeStatus( status );

        // add content type
        if ( contentType && !headers.get( "content-type" ) ) headers.set( "content-type", contentType );

        // write headers
        for ( const [header, value] of headers.entries() ) {

            // XXX capitalize headers???
            this.#res.writeHeader( header, value );
        }

        // no body
        if ( !writeBody ) {
            this.#res.end( "", close );
        }

        // write body stream
        else if ( body instanceof stream.Readable ) {
            await this.#writeStream( body, contentLength );

            if ( close ) this.close();
        }

        // write body buffer
        else {
            this.#res.end( body, close );
        }

        return this;
    }

    // also calls abort callbacks
    close () {
        this.#res.close();

        return this;
    }

    // XXX REMOVE
    writeHead ( status, headers ) {

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

    writeHeaders ( headers ) {
        for ( const header in headers ) {
            this.#res.writeHeader( header, headers[header] + "" );
        }

        return this;
    }

    writeHeader ( header, value ) {
        this.#res.writeHeader( header, value + "" );

        return this;
    }

    write ( chunk ) {
        this.#res.write( chunk );

        return this;
    }

    end ( data, closeConnection ) {
        this.#isEnded = true;

        this.#res.end( data, closeConnection );

        return this;
    }

    cork ( callback ) {
        this.#res.cork( callback );
    }

    tryEnd ( chunk, size ) {
        const [ok, done] = this.#res.tryEnd( chunk, size );

        if ( done ) this.#isEnded = true;

        return [ok, done];
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

        this.once( "abort", () => readStream.destroy() );

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
        this.#isEnded = true;

        this.emit( "abort" );
    }

    // XXX
    async #writeStream ( stream, size ) {
        this.once( "abort", () => stream.destroy() );

        var done,
            noBackpressure,
            ab,
            abOffset = 0;

        // XXX
        stream.once( "error", () => {} );

        stream.once( "end", () => {
            console.log( "-------- END" );

            this.#res.end( "" );
        } );

        stream.on( "data", buffer => {
            const chunk = buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength ),
                lastOffset = this.getWriteOffset();

            // first try
            if ( size ) {

                // Use in conjunction with onWritable. Returns tuple [ok, hasResponded].
                [noBackpressure, done] = this.#res.tryEnd( chunk, size );
            }
            else {

                // Returns true if no backpressure was added
                noBackpressure = this.#res.write( chunk );
            }

            // all data sent to client
            if ( done ) {
                stream.destroy();
            }
            else if ( !noBackpressure ) {

                // pause because backpressure
                stream.pause();

                // save unsent chunk for later
                ab = chunk;

                abOffset = lastOffset;

                // register async handlers for drainage
                this.onWritable( offset => {
                    if ( size ) {
                        [noBackpressure, done] = this.#res.tryEnd( ab.slice( offset - abOffset ), size );
                    }
                    else {
                        noBackpressure = this.#res.write( chunk );
                    }

                    if ( done ) {
                        stream.destroy();
                    }
                    else if ( noBackpressure ) {
                        stream.resume();
                    }

                    return noBackpressure;
                } );
            }
        } );
    }

    async #writeBuffer ( buffer ) {

        // ???
        // buffer = buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );

        const size = buffer.length;

        var ok, done;

        [ok, done] = this.#res.tryEnd( buffer, size );

        // all data sent
        if ( done ) return;

        // back pressure
        return new Promise( resolve => {
            this.#res.onWritable( offset => {
                [ok, done] = this.#res.tryEnd( buffer.slice( offset ), size );

                if ( done ) resolve();

                return ok;
            } );
        } );
    }
}
