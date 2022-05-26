import Events from "#lib/events";
import subnets from "#lib/ip/subnets";
import IpAddress from "#lib/ip/address";
import { createBrotliCompress, createGzip, createDeflate } from "zlib";
import { Readable } from "#lib/stream";
import Headers from "#lib/http/headers";
import StreamFormData from "#lib/stream/form-data";
import stream from "#lib/stream";
import File from "#lib/file";
import { objectIsPlain } from "#lib/utils";
import mime from "#lib/mime";

const COMPRESSORS = {
    "gzip": createGzip,
    "br": createBrotliCompress,
    "deflate": createDeflate,
};

const DEFAULT_COMPRESS = 1024 * 512;

const BASE_URL = new URL( "file:" );

export default class Request extends Events {
    #server;
    #req;
    #res;

    #isAborted;
    #isEnded;

    #method;
    #remoteAddress;
    #realRemoteAddress;
    #headers;
    #rawUrl;
    #url;
    #path;
    #searchParams;
    #stream;
    #formData;

    constructor ( server, req, res ) {
        super();

        this.#server = server;
        this.#req = req;
        this.#res = res;

        this.#method = this.#req.getMethod();

        this.#rawUrl = this.#req.getUrl();

        this.#headers = new Headers();
        this.#req.forEach( ( key, value ) => this.#headers.append( key, value, { "validate": false } ) );

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

            // remote address is trusted
            if ( this.#isIpAddressTrusted( this.remoteAddress ) ) {
                if ( this.headers.get( "x-forwarded-for" ) ) {
                    const xForwardedFor = this.headers.get( "x-forwarded-for" ).split( /\s*,\s*/ );

                    while ( xForwardedFor.length ) {
                        try {
                            this.#realRemoteAddress = IpAddress.new( xForwardedFor.pop() );

                            const subnet = this.#isIpAddressTrusted( this.#realRemoteAddress );

                            // ip address is not trusted
                            if ( !subnet ) break;

                            if ( subnet === "google-cloud-load-balancers" ) xForwardedFor.pop();
                        }
                        catch ( e ) {

                            // ip address parsing error
                            this.#realRemoteAddress = this.remoteAddress;

                            break;
                        }
                    }
                }
                else if ( this.headers.get( "x-real-ip" ) ) {
                    try {
                        this.#realRemoteAddress = IpAddress.new( this.headers.get( "x-real-ip" ) );
                    }
                    catch ( e ) {}
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
        if ( this.#url === undefined ) {
            try {
                this.#url = new URL( this.#rawUrl, BASE_URL );
            }
            catch ( e ) {
                this.#url = null;
            }
        }

        return this.#url;
    }

    get path () {
        if ( this.#path === undefined ) {
            const url = this.url;

            if ( url && url.protocol === "file:" ) {
                this.#path = decodeURI( url.pathname );
            }
            else {
                this.#path = null;
            }
        }

        return this.#path;
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
        return this.stream.blob( { maxLength, "type": type || this.headers.get( "content-type" ) } );
    }

    async tmpFile ( options ) {
        return this.stream.tmpFile( { "type": this.headers.get( "content-type" ), ...options } );
    }

    async end ( body, close ) {
        if ( this.#isAborted || this.#isEnded ) return;

        var status, headers, lastModified, eTag, compress, zlibOptions;

        if ( objectIsPlain( body ) ) ( { status, headers, body, lastModified, eTag, compress, zlibOptions } = body );
        else if ( objectIsPlain( close ) ) ( { status, headers, lastModified, eTag, compress, zlibOptions, close } = close );

        status ||= 200;

        if ( typeof status !== "number" ) throw Error( `Status must be a number` );

        this.#isEnded = true;

        const methodIsHead = this.method === "head";

        // prepare headers
        headers = new Headers( headers );

        var contentType,
            contentLength,
            transferEncodingChunked,
            range = this.headers.range;

        // lastModified from options
        if ( lastModified ) {
            if ( typeof lastModified === "string" ) lastModified = new Date( lastModified );

            headers.set( "last-modified", lastModified.toUTCString() );
        }
        else {
            lastModified = headers.has( "last-modified" );

            // lastModified from headers
            if ( lastModified ) {
                lastModified = new Date( lastModified );
            }

            // lastModified from file
            else if ( body instanceof File ) {
                lastModified = body.lastModifiedDate;

                if ( lastModified ) headers.set( "last-modified", lastModified.toUTCString() );
            }
        }

        // eTag from options
        if ( eTag ) {
            eTag = String( eTag );

            headers.set( "etag", eTag );
        }
        else {
            eTag = headers.get( "etag" );
        }

        // last modified cache
        if ( lastModified ) {
            let ifModifiedSince = this.headers.get( "if-modified-since" );

            if ( ifModifiedSince ) {
                ifModifiedSince = new Date( ifModifiedSince );

                if ( lastModified <= ifModifiedSince ) {
                    status = 304;
                    body = null;
                }
            }
        }

        // etag cache
        if ( eTag && status !== 304 ) {
            const ifNoneMatch = this.headers.get( "if-none-match" ),
                ifMatch = this.headers.get( "if-match" );

            if ( ifNoneMatch && ifNoneMatch === eTag ) {
                status = 304;
                body = null;
            }
            else if ( ifMatch && ifMatch !== eTag ) {
                status = 412;
                body = null;
            }
        }

        // prepare body
        if ( body ) {

            // file
            if ( body instanceof File ) {
                contentLength = body.size;

                if ( contentLength == null ) {
                    status = 404;

                    body = null;
                }
                else {
                    contentType = body.type;

                    headers.set( "accept-ranges", "bytes" );

                    if ( range ) {

                        // invalid range
                        if ( range.isMultiple || !( range = headers.getContentRange( range.unit, range.ranges[0], body.size ) ) ) {
                            status = 416; // Range Not Satisfiable
                            body = null;
                        }

                        // valid range
                        else {
                            contentLength = range.size;
                            status = 206; // Partial Content
                            headers.set( "content-range", range.contentRange );
                            if ( !methodIsHead ) body = body.stream( { "start": range.start, "end": range.end } );
                        }
                    }
                    else {
                        contentLength = body.size;
                        if ( !methodIsHead ) body = body.stream();
                    }
                }
            }

            // blob
            else if ( body instanceof Blob ) {
                contentType = body.type;

                headers.set( "accept-ranges", "bytes" );

                if ( range ) {

                    // invalid range
                    if ( range.isMultiple || !( range = headers.getContentRange( range.unit, range.ranges[0], body.size ) ) ) {
                        status = 416; // Range Not Satisfiable
                        body = null;
                    }

                    // valid range
                    else {
                        contentLength = range.size;
                        status = 206; // Partial Content
                        headers.set( "content-range", range.contentRange );
                        if ( !methodIsHead ) body = body.slice( range.start, range.end );
                    }
                }
                else {
                    contentLength = body.size;
                    if ( !methodIsHead ) body = await body.arrayBuffer();
                }
            }

            // stream
            else if ( body instanceof stream.Readable ) {

                // range is not supported
                if ( range ) {
                    status = 416; // Range Not Satisfiable
                    body = null;
                }
            }

            // string, buffer, array buffer
            else {
                headers.set( "accept-ranges", "bytes" );

                if ( body ) {
                    if ( typeof body === "string" ) contentLength = body.length;
                    else contentLength = body.byteLength;
                }

                if ( range ) {

                    // invalid range
                    if ( range.isMultiple || !( range = headers.getContentRange( range.unit, range.ranges[0], contentLength ) ) ) {
                        status = 416; // Range Not Satisfiable
                        body = null;
                    }

                    // valid range
                    else {
                        contentLength = range.size;
                        status = 206; // Partial Content
                        headers.set( "content-range", range.contentRange );

                        if ( Buffer.isBuffer( body ) ) {
                            if ( !methodIsHead ) body = body.subarray( range.start, range.end );
                        }
                        else {
                            if ( !methodIsHead ) body = body.slice( range.start, range.end );
                        }
                    }
                }
            }
        }

        // prepare status
        status = result.getHttpStatus( status );
        status += " " + result.getStatusText( status );

        // add content type
        if ( contentType && !headers.get( "content-type" ) ) headers.set( "content-type", contentType );

        // compress
        COMPRESS: if ( compress && body && !headers.get( "content-encoding" ) ) {
            if ( compress === true ) compress = DEFAULT_COMPRESS;

            if ( contentLength < compress ) break COMPRESS;

            const mimeType = mime.get( headers.get( "content-type" ) );

            if ( !mimeType?.compressible ) break COMPRESS;

            const acceptEncoding = this.headers.acceptEncoding;

            if ( !acceptEncoding ) break COMPRESS;

            for ( const encoding of acceptEncoding ) {
                const compressor = COMPRESSORS[encoding];

                if ( compressor ) {
                    if ( !methodIsHead ) {
                        if ( !( body instanceof stream.Readable ) ) body = stream.Readable.from( body, { "objectMode": false } );

                        body = body.pipe( compressor( zlibOptions ) );
                    }

                    contentLength = null;
                    transferEncodingChunked = true;

                    headers.set( "content-encoding", encoding );
                    headers.append( "vary", "accept-encoding" );

                    break;
                }
            }
        }

        if ( methodIsHead ) {
            if ( contentLength ) {
                headers.set( "content-length", contentLength );
            }
            else if ( transferEncodingChunked || body instanceof stream.Readable ) {
                headers.set( "transfer-encoding", "chunked" );
            }
        }

        // do not write body for "head" method
        if ( methodIsHead ) {
            if ( body instanceof stream.Readable ) body.destroy;

            body = null;
        }

        // write head
        this.#res.cork( () => {

            // write status
            this.#res.writeStatus( status );

            // write headers
            for ( const [header, value] of headers.entries() ) {
                this.#res.writeHeader( headers.normalizeHeaderName( header ), value );
            }

            // write body buffer
            if ( !body ) {

                // this.#res.endWithoutBody( 0, close ); // XXX
                this.#res.endWithoutBody();
            }

            // write body buffer
            else if ( !( body instanceof stream.Readable ) ) {
                this.#res.end( body, close );
            }
        } );

        // write body stream
        if ( body instanceof stream.Readable ) await this.#writeStream( body, contentLength, close );
    }

    // also calls abort callbacks
    close () {
        if ( this.#isAborted ) return;

        this.#res.close();
    }

    // private
    #onAborted () {
        if ( this.#isAborted ) return;

        this.#isAborted = true;
        this.#isEnded = true;

        this.emit( "abort" );
    }

    // XXX tryEnd close is not supported
    async #writeStream ( stream, size, close ) {
        this.once( "abort", () => stream.destroy() );

        var ok, done, chunk, lastOffset;

        return new Promise( resolve => {
            stream.once( "close", resolve );

            stream.once( "error", () => this.close() );

            stream.once( "end", () => {

                // end request, if chunked transfer was used
                if ( !this.#isAborted && !size ) this.#res.end( undefined, close );
            } );

            stream.on( "data", buffer => {
                chunk = buffer;

                // first try
                if ( size ) {
                    lastOffset = this.#res.getWriteOffset();

                    [ok, done] = this.#res.tryEnd( chunk, size, close );
                }
                else {
                    ok = this.#res.write( chunk );
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
                        if ( !size ) {
                            stream.resume();

                            return true;
                        }
                        else {
                            if ( Buffer.isBuffer( chunk ) ) {
                                [ok, done] = this.#res.tryEnd( chunk.subarray( offset - lastOffset ), size, close );
                            }
                            else {
                                [ok, done] = this.#res.tryEnd( chunk.slice( offset - lastOffset ), size, close );
                            }

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

    #isIpAddressTrusted ( address ) {
        const realRemoteAddressTrustedSubnets = this.#server.realRemoteAddressTrustedSubnets;

        if ( !realRemoteAddressTrustedSubnets ) return;

        if ( !realRemoteAddressTrustedSubnets === true ) return true;

        for ( const subnet of realRemoteAddressTrustedSubnets ) {
            if ( subnets.get( subnet )?.includes( address ) ) return subnet;
        }
    }
}
