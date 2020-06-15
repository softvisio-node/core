const uws = require( "uws" );
const fs = require( "./fs" );
const { createBrotliCompress, createGzip, createDeflate } = require( "zlib" );
const STATUS = fs.config.read( __dirname + "/../resources/status.json" );
const getMime = require( "./mime" );
const path = require( "path" );
const bytes = "bytes=";
const CACHE = {};
const compressions = {
    "gzip": createGzip,
    "br": createBrotliCompress,
    "deflate": createDeflate,
};

// cache: bool, number
// compress: bool, number
// headers: {}
// zlibOptions: https://nodejs.org/api/zlib.html#zlib_class_options
// fallback: function, in case if file not found
async function sendFile ( res, req, path, options = {} ) {
    res.onAborted( () => {} );

    try {
        // var stat = await fs.promises.stat( path );

        var stat = fs.statSync( path );
    }
    catch ( e ) {}

    // file not found or directory
    if ( !stat || !stat.isFile() ) {
        if ( options.fallback ) {
            options.fallback( this, req );
        }
        else {
            res.writeStatus( 404 ).end();
        }

        return;
    }

    var { mtime, size } = stat;
    mtime.setMilliseconds( 0 );
    const mtimeutc = mtime.toUTCString();

    var reqHeaders = {
        "if-modified-since": req.getHeader( "if-modified-since" ),
        "range": req.getHeader( "range" ),
    };

    var cache = !options.cache ? false : options.cache === true ? true : size >= options.cache,
        compress = !options.compress ? false : options.compress === true ? true : size >= options.compress,
        headers = options.headers ? { ...options.headers } : {};

    // return 304 if last-modified
    if ( reqHeaders["if-modified-since"] ) {
        if ( new Date( reqHeaders["if-modified-since"] ) >= mtime ) {
            res.writeStatus( 304 ).end();

            return;
        }
    }

    headers["Last-Modified"] = mtimeutc;

    // mime
    var mime = getMime( path );
    if ( mime ) {
        if ( !mime.compressible ) compress = false;

        headers["Content-Type"] = mime.type;
    }

    // write data
    let start = 0,
        end = size - 1;

    // range
    if ( reqHeaders.range ) {
        cache = false;
        compress = false;

        const parts = reqHeaders.range.replace( bytes, "" ).split( "-" );

        start = parseInt( parts[0], 10 );

        end = parts[1] ? parseInt( parts[1], 10 ) : end;

        headers["Accept-Ranges"] = "bytes";

        headers["Content-Range"] = `bytes ${start}-${end}/${size}`;

        size = end - start + 1;

        res.writeStatus( 206 );
    }

    // for size = 0
    if ( end < 0 ) end = 0;

    let readStream = fs.createReadStream( path, { start, end } );

    // compression
    let compressed = false;

    if ( compress ) {
        const accept_encoding = req.getHeader( "accept-encoding" );

        for ( const type in compressions ) {
            if ( accept_encoding.indexOf( type ) > -1 ) {
                compressed = type;

                const compressor = compressions[type]( options.zlibOptions );

                readStream.pipe( compressor );

                readStream = compressor;

                headers["Content-Encoding"] = type;

                break;
            }
        }
    }

    res.onAborted( () => readStream.destroy() );

    res.writeHeader( headers );

    // return cached content
    if ( cache ) {
        const key = `${path}-${mtimeutc}-${start}-${end}-${compressed}`;

        // file already cached
        if ( CACHE[key] ) {
            res.write( CACHE[key] ).end();

            return;
        }

        // fill cache
        // TODO how to handle stream errors
        const buffers = [];

        readStream.on( "data", ( buffer ) => {
            buffers.push( buffer );
        } );

        readStream.on( "end", () => {
            CACHE[key] = Buffer.concat( buffers );

            res.write( CACHE[key] );
        } );
    }
    else if ( compressed ) {
        readStream.on( "data", ( buffer ) => {
            res.write( buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength ) );
        } );
    }
    else {
        readStream.on( "data", ( buffer ) => {
            const chunk = buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength ),
                lastOffset = res.getWriteOffset();

            // first try
            const [ok, done] = res.tryEnd( chunk, size );

            if ( done ) {
                readStream.destroy();
            }
            else if ( !ok ) {

                // pause because backpressure
                readStream.pause();

                // save unsent chunk for later
                res.ab = chunk;
                res.abOffset = lastOffset;

                // register async handlers for drainage
                res.onWritable( ( offset ) => {
                    const [ok, done] = res.tryEnd( res.ab.slice( offset - res.abOffset ), size );

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

    readStream
        .on( "error", ( e ) => {
            res.writeStatus( 500 );

            res.end();

            readStream.destroy();

            throw e;
        } )
        .on( "end", () => {
            res.end();
        } );
}

// TODO add body handlers, copy from sifrr, https://github.com/sifrr/sifrr/tree/master/packages/server/sifrr-server
// TODO methods, with allowed body: patch, post, put
class Request {
    #req;

    constructor ( req ) {
        this.#req = req;
    }

    getHeader () {
        return this.#req.getHeader( ...arguments );
    }

    getParameter () {
        return this.#req.getParameter( ...arguments );
    }

    getUrl () {
        return this.#req.getUrl( ...arguments );
    }

    getMethod () {
        return this.#req.getMethod( ...arguments );
    }

    getQuery () {
        return this.#req.getQuery( ...arguments );
    }

    forEach () {
        return this.#req.forEach( ...arguments );
    }

    setYield () {
        return this.#req.setYield( ...arguments );
    }
}

class Response {
    #res;

    aborted;

    constructor ( res, isAsync ) {
        this.#res = res;

        if ( isAsync ) {
            res.onAborted( () => {
                this.aborted = true;
            } );
        }
    }

    end () {
        this.#res.end( ...arguments );

        return this;
    }

    tryEnd () {
        return this.#res.tryEnd( ...arguments );
    }

    onAborted () {
        this.#res.onAborted( ...arguments );

        return this;
    }

    writeStatus ( status ) {
        if ( typeof status === "number" ) {
            const reason = STATUS[status];

            if ( reason ) status = status + " " + reason;
        }

        this.#res.writeStatus( status );

        return this;
    }

    writeHeader ( headers, value ) {
        if ( typeof headers === "string" ) {
            this.#res.writeHeader( headers, value.toString() );
        }
        else {
            for ( const header in headers ) {
                this.#res.writeHeader( header, headers[header].toString() );
            }
        }

        return this;
    }

    write () {
        this.#res.write( ...arguments );

        return this;
    }

    close () {
        this.#res.close();

        return this;
    }

    getWriteOffset () {
        return this.#res.getWriteOffset();
    }

    onWritable () {
        this.#res.onWritable( ...arguments );

        return this;
    }

    onData () {
        this.#res.onData( ...arguments );

        return this;
    }

    getRemoteAddress () {
        return this.#res.getRemoteAddress();
    }

    getRemoteAddressAsText () {
        return this.#res.getRemoteAddressAsText();
    }

    getProxiedRemoteAddress () {
        return this.#res.getProxiedRemoteAddress();
    }

    getProxiedRemoteAddressAsText () {
        return this.#res.getProxiedRemoteAddressAsText();
    }

    cork () {
        this.#res.cork( ...arguments );
    }

    upgrade () {
        this.#res.upgrade( ...arguments );
    }

    sendFile ( req, path, options ) {
        sendFile( this, req, path, options );
    }
}

module.exports = class Server {
    #uws;

    constructor ( options = {} ) {
        this.#uws = uws.App( options );
    }

    // REQUESTS
    any ( location, handler ) {
        const isAsync = handler.constructor.name === "AsyncFunction";

        this.#uws.any( location, ( res, req ) => {
            res = new Response( res, isAsync );
            req = new Request( req );

            handler( res, req );
        } );

        return this;
    }

    get ( location, handler ) {
        const isAsync = handler.constructor.name === "AsyncFunction";

        this.#uws.get( location, ( res, req ) => {
            res = new Response( res, isAsync );
            req = new Request( req );

            handler( res, req );
        } );

        return this;
    }

    post ( location, handler ) {
        const isAsync = handler.constructor.name === "AsyncFunction";

        this.#uws.post( location, ( res, req ) => {
            res = new Response( res, isAsync );
            req = new Request( req );

            handler( res, req );
        } );

        return this;
    }

    options ( location, handler ) {
        const isAsync = handler.constructor.name === "AsyncFunction";

        this.#uws.options( location, ( res, req ) => {
            res = new Response( res, isAsync );
            req = new Request( req );

            handler( res, req );
        } );

        return this;
    }

    del ( location, handler ) {
        const isAsync = handler.constructor.name === "AsyncFunction";

        this.#uws.del( location, ( res, req ) => {
            res = new Response( res, isAsync );
            req = new Request( req );

            handler( res, req );
        } );

        return this;
    }

    patch ( location, handler ) {
        const isAsync = handler.constructor.name === "AsyncFunction";

        this.#uws.patch( location, ( res, req ) => {
            res = new Response( res, isAsync );
            req = new Request( req );

            handler( res, req );
        } );

        return this;
    }

    put ( location, handler ) {
        const isAsync = handler.constructor.name === "AsyncFunction";

        this.#uws.put( location, ( res, req ) => {
            res = new Response( res, isAsync );
            req = new Request( req );

            handler( res, req );
        } );

        return this;
    }

    head ( location, handler ) {
        const isAsync = handler.constructor.name === "AsyncFunction";

        this.#uws.head( location, ( res, req ) => {
            res = new Response( res, isAsync );
            req = new Request( req );

            handler( res, req );
        } );

        return this;
    }

    connect ( location, handler ) {
        const isAsync = handler.constructor.name === "AsyncFunction";

        this.#uws.connect( location, ( res, req ) => {
            res = new Response( res, isAsync );
            req = new Request( req );

            handler( res, req );
        } );

        return this;
    }

    trace ( location, handler ) {
        const isAsync = handler.constructor.name === "AsyncFunction";

        this.#uws.trace( location, ( res, req ) => {
            res = new Response( res, isAsync );
            req = new Request( req );

            handler( res, req );
        } );

        return this;
    }

    ws () {
        this.#uws.ws( ...arguments );

        return this;
    }

    publish () {
        this.#uws.publish( ...arguments );

        return this;
    }

    listen () {
        this.#uws.listen( ...arguments );

        return this;
    }

    // EXTENSIONS
    file ( location, file, options ) {
        file = path.normalize( file );

        // ensure slash in beginning and no trailing slash for prefix
        if ( location[0] !== "/" ) location = "/" + location;
        if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

        this.get( location, ( res, req ) => {
            res.sendFile( req, file, options );
        } );

        return this;
    }

    folder ( location, folder, options ) {
        folder = path.normalize( folder );

        // ensure slash in beginning and no trailing slash for prefix
        if ( location[0] !== "/" ) location = "/" + location;
        if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

        if ( location === "" ) {

            // 301 /index.html -> /
            this.get( "/index.html", ( res, req ) => {
                res.writeStatus( 301 ).writeHeader( "Location", "/" ).end();
            } );
        }
        else {

            // 301 /location -> /location/
            this.get( location, ( res, req ) => {
                res.writeStatus( 301 ).writeHeader( "Location", `${location}/` ).end();
            } );

            // 301 /location/index.html -> /location/
            this.get( `${location}/index.html`, ( res, req ) => {
                res.writeStatus( 301 ).writeHeader( "Location", `${location}/` ).end();
            } );
        }

        this.get( `${location}/*`, ( res, req ) => {
            const filepath = path.normalize( decodeURI( req.getUrl() ) ).substr( location.length );

            if ( filepath === path.sep ) {
                res.sendFile( req, folder + path.sep + "index.html", options );
            }
            else {
                res.sendFile( req, folder + filepath, options );
            }
        } );

        return this;
    }

    webpack ( location, folder, options = {} ) {
        folder = path.normalize( folder );

        // ensure slash in beginning and no trailing slash for prefix
        if ( location[0] !== "/" ) location = "/" + location;
        if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

        const optionsIndex = {
                "cache": options.cache != null ? options.cache : 1024 * 1024 * 10, // 10M
                "compress": options.compress != null ? options.compress : 128, // 128b
                "headers": {
                    "Cache-Control": "public, private, must-revalidate, proxy-revalidate",
                },
            },
            optionsOther = {
                "cache": options.cache != null ? options.cache : 1024 * 1024 * 10, // 10M
                "compress": options.compress != null ? options.compress : 128, // 128b
                "headers": {
                    "Cache-Control": "public, max-age=30672000",
                },
            };

        if ( location === "" ) {

            // 301 /index.html -> /
            this.get( "/index.html", ( res, req ) => {
                res.writeStatus( 301 ).writeHeader( "Location", "/" ).end();
            } );
        }
        else {

            // 301 /location -> /location/
            this.get( location, ( res, req ) => {
                res.writeStatus( 301 ).writeHeader( "Location", `${location}/` ).end();
            } );

            // 301 /location/index.html -> /location/
            this.get( `${location}/index.html`, ( res, req ) => {
                res.writeStatus( 301 ).writeHeader( "Location", `${location}/` ).end();
            } );
        }

        this.get( `${location}/*`, ( res, req ) => {
            const filepath = path.normalize( decodeURI( req.getUrl() ) ).substr( location.length );

            if ( filepath === path.sep ) {
                res.sendFile( req, folder + path.sep + "index.html", optionsIndex );
            }
            else {
                res.sendFile( req, folder + filepath, optionsOther );
            }
        } );

        return this;
    }

    api ( location, api, options = {} ) {

        // ensure slash in beginning and no trailing slash for prefix
        if ( location[0] !== "/" ) location = "/" + location;
        if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

        const cfg = {
            "compression": options.compression ? 1 : 0, // 0 = no compression, 1 = shared compressor, 2 = dedicated compressor
            "maxPayloadLength": options.maxPayloadLength != null ? options.maxPayloadLength : 1024 * 1024 * 10,
            "idleTimeout": options.idleTimeout || 60 * 10, // seconds
            "maxBackpressure": options.maxBackpressure, // maximum length of allowed backpressure per socket when publishing messages. Slow receivers, WebSockets, will be disconnected if needed

            ...api.getWebsocketConfig(),
        };

        if ( location === "" ) {
            this.ws( "/", cfg );
        }
        else {
            this.ws( location, cfg );
            this.ws( `${location}/`, cfg );
        }

        return this;
    }
};
