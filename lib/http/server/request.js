import Events from "#lib/events";
import subnets from "#lib/ip/subnets";
import IpAddress from "#lib/ip/address";
import { createBrotliCompress, createGzip, createDeflate } from "zlib";
import path from "path";
import { Readable } from "#lib/stream";
import Headers from "#lib/http/headers";
import StreamFormData from "#lib/stream/form-data";
import stream from "#lib/stream";
import File from "#lib/file";
import { objectIsPlain } from "#lib/utils";
import mime from "#lib/mime";

const COMPRESSIONS = {
    "gzip": createGzip,
    "br": createBrotliCompress,
    "deflate": createDeflate,
};

const DEFAULT_COMPRESS_THRESHOLD = 1024 * 512;

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

            const xRealIp = this.headers.get( "x-real-ip" );

            // x-real-ip header is trusted
            if ( xRealIp && subnets.get( "private" ).includes( this.remoteAddress ) ) {
                try {
                    this.#realRemoteAddress = new IpAddress( xRealIp );
                }
                catch ( e ) {}
            }

            const cloudflareConnectingIp = this.headers.get( "cf-connecting-ip" );

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
        var status, headers, compress, zlibOptions;

        if ( objectIsPlain( body ) ) ( { status, headers, body, compress, zlibOptions } = body );
        else if ( objectIsPlain( close ) ) ( { status, headers, close, compress, zlibOptions } = close );

        status ||= 200;

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

        // prepare body
        if ( body ) {

            // file
            if ( body instanceof File ) {
                if ( !body.hasContent ) {
                    status = 404;

                    body = null;
                }
                else {
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

                if ( body ) {
                    if ( typeof body === "string" ) contentLength = body.length;
                    else contentLength = body.byteLength;
                }
            }
        }

        // do not write body for "head" method
        if ( this.method === "head" ) {
            if ( body instanceof stream.Readable ) body.destroy;

            body = null;
        }

        // prepare status
        status = result.getHttpStatus( status );
        status += " " + result.getStatusText( status );

        // add content type
        if ( contentType && !headers.get( "content-type" ) ) headers.set( "content-type", contentType );

        // compress
        COMPRESS: if ( compress && body && !headers.get( "content-encoding" ) ) {
            if ( compress === true ) compress = DEFAULT_COMPRESS_THRESHOLD;

            if ( contentLength < compress ) break COMPRESS;

            const mimeType = mime.get( headers.get( "content-type" ) );

            if ( !mimeType?.compressible ) break COMPRESS;

            const acceptEncoding = this.headers.get( "accept-encoding" );

            if ( !acceptEncoding ) break COMPRESS;

            // XXX iterate in order
            for ( const type in COMPRESSIONS ) {
                if ( acceptEncoding.includes( type ) ) {
                    if ( !( body instanceof stream.Readable ) ) body = stream.Readable.from( body, { "objectMode": false } );

                    body = body.pipe( COMPRESSIONS[type]( zlibOptions ) );

                    contentLength = null;

                    headers.set( "content-encoding", type );

                    break;
                }
            }
        }

        // write head
        this.#res.cork( () => {

            // write status
            this.#res.writeStatus( status );

            // write headers
            for ( const [header, value] of headers.entries() ) {
                this.#res.writeHeader( header, value );
            }
        } );

        // no body
        if ( !body ) {
            this.#res.end( "", close );
        }

        // write body stream
        else if ( body instanceof stream.Readable ) {
            await this.#writeStream( body, contentLength, close );
        }

        // write body buffer
        else {
            this.#res.end( body, close );
        }
    }

    // also calls abort callbacks
    close () {
        this.#res.close();
    }

    // private
    #onAborted () {
        if ( this.#isAborted ) return;

        this.#isAborted = true;
        this.#isEnded = true;

        this.emit( "abort" );
    }

    async #writeStream ( stream, size, close ) {
        this.once( "abort", () => stream.destroy() );

        var ok, done, chunk, lastOffset;

        return new Promise( resolve => {
            stream.once( "close", resolve );

            stream.once( "error", () => this.#res.close() );

            stream.once( "end", () => this.#res.end( "", close ) );

            stream.on( "data", buffer => {
                if ( !Buffer.isBuffer( buffer ) ) buffer = Buffer.from( buffer );

                chunk = buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );
                lastOffset = this.#res.getWriteOffset();

                // first try
                if ( size ) {
                    [ok, done] = this.#res.tryEnd( chunk, size );
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

                            return false;
                        }
                        else {
                            [ok, done] = this.#res.tryEnd( chunk.slice( offset - lastOffset ), size );

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
}
