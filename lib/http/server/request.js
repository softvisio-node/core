import { createBrotliCompress, createDeflate, createGzip } from "node:zlib";
import Events from "#lib/events";
import File from "#lib/file";
import FileStream from "#lib/file-stream";
import Headers from "#lib/http/headers";
import HttpResponse from "#lib/http/response";
import IpAddress from "#lib/ip/address";
import subnets from "#lib/ip/subnets";
import mime from "#lib/mime";
import stream, { Readable } from "#lib/stream";
import StreamFormData from "#lib/stream/form-data";
import StreamMultipart from "#lib/stream/multipart";
import { objectIsPlain } from "#lib/utils";

const COMPRESSORS = {
    "gzip": createGzip,
    "br": createBrotliCompress,
    "deflate": createDeflate,
};

const localAddress = new IpAddress( "127.0.0.1" );

export default class Request extends Events {
    #server;
    #res;
    #socketContext;

    #isAborted;
    #isEnded = false;

    #method;
    #remoteAddress;
    #realRemoteAddress;
    #headers;
    #url;
    #path;
    #hasBody;
    #bodyUsed = false;
    #body;
    #formData;
    #fileStream;
    #endEventSent;
    #abortController = new AbortController();

    constructor ( server, req, res, socketContext ) {
        super();

        this.#server = server;
        this.#res = res;
        this.#socketContext = socketContext;

        this.#method = req.getMethod();

        // headers
        this.#headers = new Headers();
        req.forEach( ( key, value ) => this.#headers.add( key, value ) );

        // has body
        this.#hasBody = !!( this.headers.contentLength || this.headers.get( "transfer-encoding" )?.toLowerCase().includes( "chunked" ) );

        // remote address
        this.#remoteAddress = this.#res.getProxiedRemoteAddressAsText();
        if ( !this.#remoteAddress.byteLength ) this.#remoteAddress = this.#res.getRemoteAddressAsText();
        this.#remoteAddress = this.#remoteAddress.byteLength
            ? new IpAddress( Buffer.from( this.#remoteAddress ).toString() )
            : localAddress;

        // url
        var url = "http://" + ( this.headers.get( "host" ) || this.#remoteAddress.toString() ) + req.getUrl() + ( req.getQuery()
            ? "?" + req.getQuery()
            : "" );

        try {
            this.#url = new URL( url );
        }
        catch {
            this.#url = null;
        }

        this.#res.onAborted( this.#onAborted.bind( this ) );
    }

    // properties
    get isAborted () {
        return this.#isAborted;
    }

    get isEnded () {
        return this.#isEnded;
    }

    get abortSignal () {
        return this.#abortController.signal;
    }

    get remoteAddress () {
        return this.#remoteAddress;
    }

    get realRemoteAddress () {
        if ( !this.#realRemoteAddress ) {
            this.#realRemoteAddress = this.remoteAddress;

            if ( this.#server.realIpHeader && this.#server.setRealIpFrom && this.#isIpAddressTrusted( this.remoteAddress ) ) {
                const addresses = this.headers.get( this.#server.realIpHeader )?.split( "," );

                if ( addresses ) {
                    while ( addresses.length ) {
                        try {
                            this.#realRemoteAddress = new IpAddress( addresses.pop().trim() );

                            if ( !this.#isIpAddressTrusted( this.#realRemoteAddress ) ) break;
                        }
                        catch {
                            break;
                        }
                    }
                }
            }
        }

        return this.#realRemoteAddress;
    }

    get method () {
        return this.#method;
    }

    get headers () {
        return this.#headers;
    }

    get url () {
        return this.#url;
    }

    get path () {
        if ( this.#path === undefined ) {
            if ( this.url ) {
                this.#path = decodeURI( this.url.pathname );
            }
            else {
                this.#path = null;
            }
        }

        return this.#path;
    }

    // XXX https://github.com/uNetworking/uWebSockets.js/issues/1095
    get hasBody () {
        return this.#hasBody;
    }

    get bodyUsed () {
        return this.#bodyUsed;
    }

    get body () {
        if ( !this.#body ) {
            this.#body = new Readable( { read () {} } );

            const abortHandler = () => this.#body.destroy( `HTTP request aborted` );

            this.once( "abort", abortHandler );

            this.#res.onData( ( arrayBuffer, isLast ) => {

                // make a copy of array buffer
                this.#body.push( Buffer.concat( [ Buffer.from( arrayBuffer ) ] ) );

                // eof
                if ( isLast ) {
                    this.#bodyUsed = true;

                    this.off( "abort", abortHandler );

                    this.#body.push( null );
                }
            } );
        }

        return this.#body;
    }

    get formData () {
        if ( !this.#formData ) {
            this.#formData = new StreamFormData( this.headers.contentType?.boundary );

            stream.pipeline( this.body, this.#formData, () => {} );
        }

        return this.#formData;
    }

    // public
    async end ( options ) {
        if ( this.#isAborted || this.#isEnded ) return;

        this.#isEnded = true;

        await this.#end( options );

        this.#onEnd();
    }

    // also calls abort callbacks
    close ( status ) {
        if ( this.#isAborted ) return;

        if ( status ) {
            if ( typeof status !== "number" ) throw new Error( `Status must be a number` );

            status = result.getHttpStatus( status );
            status += " " + result.getStatusText( status );

            this.#res.cork( () => {

                // write status
                this.#res.writeStatus( status );

                // write body buffer
                this.#res.endWithoutBody( 0, true );
            } );

            this.#onEnd();
        }
        else {
            this.#res.close();
        }
    }

    upgrade ( { data, key, protocol, extensions } = {} ) {
        if ( this.#isAborted || this.#isEnded ) return;

        this.#isEnded = true;

        key ??= this.headers.get( "sec-websocket-key" );
        protocol ??= this.headers.get( "sec-websocket-protocol" );
        extensions ??= this.headers.get( "sec-websocket-extensions" );

        this.#res.cork( () => {
            this.#res.upgrade(
                {
                    "remoteAddress": this.realRemoteAddress,
                    data,
                },
                key,
                protocol,
                extensions,
                this.#socketContext
            );
        } );

        this.#onEnd();
    }

    // body methods
    async buffer ( { maxLength } = {} ) {
        return this.body.buffer( { maxLength } );
    }

    async json ( { maxLength } = {} ) {
        return this.body.json( { maxLength } );
    }

    async text ( { maxLength, encoding } = {} ) {
        return this.body.text( { maxLength, encoding } );
    }

    async arrayBuffer ( { maxLength } = {} ) {
        return this.body.arrayBuffer( { maxLength } );
    }

    async blob ( { maxLength, type } = {} ) {
        return this.body.blob( { maxLength, "type": type || this.headers.get( "content-type" ) } );
    }

    async tmpFile ( options ) {
        return this.body.tmpFile( { "type": this.headers.get( "content-type" ), ...options } );
    }

    fileStream ( { name, type } = {} ) {
        if ( !this.#fileStream ) {
            this.#fileStream = new FileStream( this.body, {
                name,
                "type": type === undefined
                    ? this.headers.get( "content-type" )
                    : type,
                "size": this.headers.contentLength,
            } );
        }

        return this.#fileStream;
    }

    // private
    #onAborted () {
        if ( this.#isAborted ) return;

        this.#isAborted = true;
        this.#isEnded = true;

        this.#abortController.abort();

        this.emit( "abort" );

        this.#onEnd();
    }

    #isIpAddressTrusted ( address ) {
        for ( const subnet of this.#server.setRealIpFrom ) {
            if ( subnets.get( subnet )?.includes( address ) ) return true;
        }
    }

    async #end ( options ) {
        var status, headers, body, compress, zlibOptions;

        // parse options
        {
            if ( !options ) {
                status = 200;
            }

            // options is status number
            else if ( typeof options === "number" ) {
                status = options;
            }

            // options is plain object
            else if ( objectIsPlain( options ) ) {
                ( { status, headers, body, compress, zlibOptions } = options );
            }

            // options is http response
            else if ( options instanceof HttpResponse ) {
                status = options.status;
                headers = options.headers;
                body = options.body;
            }

            // options is result
            else if ( options instanceof result.Result ) {
                status = options.status;

                if ( objectIsPlain( options.data ) ) {
                    ( { headers, body, compress, zlibOptions } = options.data );
                }
                else {
                    body = options.data;
                }
            }

            // options is body
            else {
                body = options;
            }
        }

        var contentType, contentLength;

        const methodIsHead = this.method === "head";

        compress ??= this.#server.compress;

        // prepate status
        if ( status ) {
            if ( typeof status !== "number" ) throw new Error( `Status must be a number` );
        }
        else {
            status = 200;
        }

        // prepare headers
        if ( headers ) {
            if ( !( headers instanceof Headers ) ) headers = new Headers( headers );

            contentLength = headers.contentLength;

            headers.delete( "content-length" );
            headers.delete( "transfer-encoding" );
        }
        else {
            headers = new Headers();
        }

        // cache
        CACHE: {
            let lastModified = headers.get( "last-modified" );

            if ( lastModified ) {
                lastModified = new Date( lastModified );

                if ( Number.isNaN( lastModified.getTime() ) ) {
                    lastModified = null;

                    headers.delete( "last-modified" );
                }
            }
            else if ( body instanceof File ) {
                lastModified = await body.getLastModifiedDate();

                if ( lastModified ) headers.set( "last-modified", lastModified.toUTCString() );
            }

            if ( status === 304 ) break CACHE;

            // etag
            const etag = headers.get( "etag" );

            ETAG: if ( etag ) {

                // etag is weak
                if ( etag.startsWith( "W/" ) ) break ETAG;

                if ( etag === this.headers.get( "if-none-match" ) ) {
                    status = 304;
                    body = this.#closeBody( body );

                    break CACHE;
                }
                else if ( this.headers.has( "if-match" ) && etag !== this.headers.get( "if-match" ) ) {
                    status = 412; // Precondition Failed
                    body = this.#closeBody( body );

                    break CACHE;
                }
            }

            // if-modified since
            if ( lastModified ) {
                let ifModifiedSince = this.headers.get( "if-modified-since" );

                if ( ifModifiedSince ) {
                    ifModifiedSince = new Date( ifModifiedSince );

                    if ( Number.isNaN( ifModifiedSince.getTime() ) ) break CACHE;

                    if ( lastModified <= ifModifiedSince ) {
                        status = 304;
                        body = this.#closeBody( body );

                        break CACHE;
                    }
                }
            }
        }

        // prepare body
        BODY: {
            if ( body ) {
                let rangeSupported;

                // body is function
                if ( typeof body === "function" ) {
                    const res = await body();

                    status = res.status;

                    let resHeaders = res.data?.headers;

                    if ( resHeaders ) {
                        if ( !( resHeaders instanceof Headers ) ) resHeaders = new Headers( resHeaders );

                        for ( const [ header, value ] of resHeaders.entries() ) {
                            if ( header === "content-length" ) {
                                contentLength = resHeaders.contentLength;
                            }
                            else if ( header === "content-type" ) {
                                contentType = value;
                            }
                            else {
                                headers.set( header, value );
                            }
                        }
                    }

                    body = res.data?.body;

                    if ( !body ) break BODY;
                }

                if ( typeof body === "string" ) {
                    rangeSupported = true;

                    contentLength = Buffer.byteLength( body );
                }
                else if ( Buffer.isBuffer( body ) ) {
                    rangeSupported = true;

                    contentLength = body.length;
                }
                else if ( body instanceof File ) {
                    rangeSupported = true;

                    contentLength = await body.getSize();
                    contentType ||= body.type;

                    // file not exists
                    if ( contentLength == null ) {
                        status = 404;
                        body = this.#closeBody( body );
                        break BODY;
                    }
                }
                else if ( body instanceof Blob ) {
                    rangeSupported = true;

                    contentLength = body.size;
                    contentType ||= body.type;
                }
                else if ( body instanceof FileStream ) {
                    contentLength = body.size;
                    contentType ||= body.type;
                }
                else if ( body instanceof StreamMultipart ) {
                    contentLength = body.length;
                    contentType = body.type;
                }

                let range;

                RANGE: {

                    // range already applied
                    if ( status === 206 || headers.has( "content-range" ) ) break RANGE;

                    if ( !headers.has( "accept-ranges" ) ) break RANGE;

                    if ( !rangeSupported ) {
                        headers.delete( "accept-ranges" );

                        break RANGE;
                    }

                    range = this.headers.range;

                    if ( !range ) break RANGE;

                    // multiple ranges are not supported
                    if ( range?.isMultiple ) range = null;

                    // check range
                    range = headers.createContentRange( range.ranges[ 0 ], contentLength );

                    // range is invalid
                    if ( !range ) {
                        status = 416; // Range Not Satisfiable
                        body = this.#closeBody( body );
                        break BODY;
                    }

                    // range is ok
                    status = 206; // Partial Content
                    contentLength = range.size;
                    headers.set( "content-range", range.contentRange );
                }

                if ( methodIsHead ) break BODY;

                if ( body instanceof File ) {
                    if ( range ) {
                        body = body.stream( { "start": range.start, "end": range.end + 1 } );
                    }
                    else {
                        body = body.stream();
                    }
                }
                else if ( body instanceof Blob ) {
                    if ( range ) {
                        body = await body.slice( range.start, range.end + 1 ).srrayBuffer();
                    }
                    else {
                        body = await body.arrayBuffer();
                    }
                }
                else if ( Buffer.isBuffer( body ) ) {
                    if ( range ) {
                        body = body.subarray( range.start, range.end + 1 );
                    }
                }
                else if ( typeof body === "string" ) {
                    if ( range ) {
                        body = Buffer.from( body ).subarray( range.start, range.end + 1 );
                    }
                }
            }
        }

        // prepare status string
        status = result.getHttpStatus( status );
        status += " " + result.getStatusText( status );

        // add content type
        if ( contentType ) headers.set( "content-type", contentType );

        // compress
        COMPRESS: {
            if ( compress && body && !headers.get( "content-encoding" ) ) {
                if ( typeof compress !== "boolean" && contentLength < compress ) break COMPRESS;

                const mimeType = mime.get( headers.get( "content-type" ) );

                if ( !mimeType?.compressible ) break COMPRESS;

                const acceptEncoding = this.headers.acceptEncoding;

                if ( !acceptEncoding ) break COMPRESS;

                for ( const encoding of acceptEncoding ) {
                    const compressor = COMPRESSORS[ encoding ];

                    if ( compressor ) {

                        // prepare compressed body stream
                        if ( !methodIsHead ) {

                            // convert body to stream
                            if ( !( body instanceof stream.Readable ) ) {
                                body = stream.Readable.from( body, { "objectMode": false } );
                            }

                            // pipe body to zlib compressor
                            body = body.pipe( compressor( zlibOptions ) );
                        }

                        contentLength = null;

                        headers.set( "content-encoding", encoding );
                        headers.add( "vary", "accept-encoding" );

                        break;
                    }
                }
            }
        }

        // add content-length header
        if ( body ) {

            // only for HEAD method
            if ( methodIsHead ) {

                // chunked transfer
                if ( contentLength == null ) {
                    headers.set( "transfer-encoding", "chunked" );
                }

                // know content length
                else {
                    headers.set( "content-length", contentLength );
                }
            }
        }
        else {
            headers.set( "content-length", 0 );
        }

        if ( methodIsHead ) {
            body = this.#closeBody( body );
        }

        // write head
        this.#res.cork( () => {

            // write status
            this.#res.writeStatus( status );

            // write headers
            for ( const [ header, value ] of headers.entries() ) {
                if ( Array.isArray( value ) ) {
                    for ( const data of value ) {
                        this.#res.writeHeader( headers.getOriginalName( header ), data );
                    }
                }
                else {
                    this.#res.writeHeader( headers.getOriginalName( header ), value );
                }
            }

            // write body buffer
            if ( !body ) {
                this.#res.endWithoutBody();
            }

            // write body buffer
            else if ( !( body instanceof stream.Readable ) ) {
                this.#res.end( body );
            }
        } );

        // write body stream
        if ( body instanceof stream.Readable ) await this.#writeStream( body, contentLength );
    }

    async #writeStream ( stream, contentLength ) {
        this.once( "abort", () => stream.destroy() );

        var ok, done, chunk, lastOffset;

        return new Promise( resolve => {
            stream.once( "close", resolve );

            stream.once( "error", () => this.close() );

            stream.once( "end", () => {

                // end request, if chunked transfer was used
                if ( !this.#isAborted && !contentLength ) {
                    this.#res.cork( () => {
                        this.#res.endWithoutBody();
                    } );
                }
            } );

            stream.on( "data", buffer => {
                chunk = buffer;

                // first try
                if ( contentLength ) {
                    lastOffset = this.#res.getWriteOffset();

                    this.#res.cork( () => {
                        [ ok, done ] = this.#res.tryEnd( chunk, contentLength );
                    } );
                }
                else {
                    this.#res.cork( () => {
                        ok = this.#res.write( chunk );
                    } );
                }

                // all data sent to client
                if ( done ) {
                    stream.destroy();
                }

                // backpressure
                else if ( !ok ) {

                    // pause because backpressure
                    stream.pause();

                    this.#res.onWritable( offset => {
                        if ( !contentLength ) {
                            stream.resume();

                            return true;
                        }
                        else {

                            // only buffers are supported
                            this.#res.cork( () => {
                                [ ok, done ] = this.#res.tryEnd( chunk.subarray( offset - lastOffset ), contentLength );
                            } );

                            // all data sent to client
                            if ( done ) {
                                stream.destroy();
                            }

                            // no backpressure
                            else if ( ok ) {
                                stream.resume();
                            }

                            return ok;
                        }
                    } );
                }
            } );
        } );
    }

    #onEnd () {
        if ( this.#endEventSent ) return;

        this.#endEventSent = true;

        this.emit( "end" );
    }

    #closeBody ( body ) {
        if ( body instanceof stream.Readable ) body.destroy();

        return null;
    }
}
