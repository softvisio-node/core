const { App } = require( "uws" );
const { config, statSync, createReadStream } = require( "./fs" );
const { createBrotliCompress, createGzip, createDeflate } = require( "zlib" );
const STATUS = config.read( __dirname + "/../resources/status.json" );
const getMime = require( "./mime" );
const bytes = "bytes=";
const CACHE = {};
const compressions = {
    "gzip": createGzip,
    "br": createBrotliCompress,
    "deflate": createDeflate,
};
const METHODS = {
    "patch": true,
    "post": true,
    "put": true,
};

// NOTE https://github.com/sifrr/sifrr/tree/master/packages/server/sifrr-server

function wrapRes ( res ) {
    res._writeStatus = res.writeStatus;
    res.writeStatus = writeStatus;

    res._writeHeader = res.writeHeader;
    res.writeHeader = writeHeader;

    res.sendFile = sendFile;
}

// TODO body handlers, copy from sifrr
function wrapReq ( res ) {}

function writeStatus ( status ) {
    if ( typeof status === "number" ) {
        const reason = STATUS[status];

        if ( reason ) status = status + " " + reason;
    }

    this._writeStatus( status );

    return this;
}

function writeHeader ( headers, value ) {
    if ( typeof headers === "string" ) {
        this._writeHeader( headers, value.toString() );
    }
    else {
        for ( const header in headers ) {
            this._writeHeader( header, headers[header].toString() );
        }
    }

    return this;
}

// cache: bool
// compress: false
// headers: {}
// zlibOptions: https://nodejs.org/api/zlib.html#zlib_class_options
async function sendFile ( req, path, options ) {
    path = decodeURI( path );

    try {
        var stat = statSync( path );
    }
    catch ( e ) {}

    // file not found or directory
    if ( !stat || !stat.isFile() ) {
        this.writeStatus( 404 ).end();

        return;
    }

    if ( !options ) options = {};

    var { mtime, size } = stat;
    mtime.setMilliseconds( 0 );
    const mtimeutc = mtime.toUTCString();

    var reqHeaders = {
        "if-modified-since": req.getHeader( "if-modified-since" ),
        "range": req.getHeader( "range" ),
    };

    var cache = options.cache,
        compress = options.compress,
        headers = options.headers ? { ...options.headers } : {};

    // return 304 if last-modified
    if ( reqHeaders["if-modified-since"] ) {
        if ( new Date( reqHeaders["if-modified-since"] ) >= mtime ) {
            this.writeStatus( 304 ).end();

            return;
        }
    }

    headers["last-modified"] = mtimeutc;

    // mime
    var mime = getMime( path );
    if ( mime ) {
        if ( !mime.compressible ) compress = false;

        headers["content-type"] = mime.type;
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

        headers["accept-ranges"] = "bytes";

        headers["content-range"] = `bytes ${start}-${end}/${size}`;

        size = end - start + 1;

        this.writeStatus( 206 );
    }

    // for size = 0
    if ( end < 0 ) end = 0;

    let readStream = createReadStream( path, { start, end } );

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

                headers["content-encoding"] = type;

                break;
            }
        }
    }

    this.onAborted( () => readStream.destroy() );

    this.writeHeader( headers );

    var res = this;

    // return cached content
    if ( cache ) {
        const key = `${path}-${mtimeutc}-${start}-${end}-${compressed}`;

        // file already cached
        if ( CACHE[key] ) {
            res.write( CACHE[key] );

            res.end();

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

class Base {
    // REQUESTS
    any ( location, handler ) {
        return this._any( location, ( res, req ) => {
            wrapRes( res );

            if ( METHODS[req.getMethod()] ) wrapReq( req );

            handler( res, req );
        } );
    }

    get ( location, handler ) {
        return this._get( location, ( res, req ) => {
            wrapRes( res );

            handler( res, req );
        } );
    }

    post ( location, handler ) {
        return this._post( location, ( res, req ) => {
            wrapRes( res );

            wrapReq( req );

            handler( res, req );
        } );
    }

    options ( location, handler ) {
        return this._options( location, ( res, req ) => {
            wrapRes( res );

            handler( res, req );
        } );
    }

    del ( location, handler ) {
        return this._del( location, ( res, req ) => {
            wrapRes( res );

            handler( res, req );
        } );
    }

    patch ( location, handler ) {
        return this._patch( location, ( res, req ) => {
            wrapRes( res );

            wrapReq( req );

            handler( res, req );
        } );
    }

    put ( location, handler ) {
        return this._put( location, ( res, req ) => {
            wrapRes( res );

            wrapReq( req );

            handler( res, req );
        } );
    }

    head ( location, handler ) {
        return this._head( location, ( res, req ) => {
            wrapRes( res );

            handler( res, req );
        } );
    }

    connect ( location, handler ) {
        return this._connect( location, ( res, req ) => {
            wrapRes( res );

            handler( res, req );
        } );
    }

    trace ( location, handler ) {
        return this._trace( location, ( res, req ) => {
            wrapRes( res );

            handler( res, req );
        } );
    }

    // METHODS
    emit ( name, ...args ) {
        this.publish( name,
            JSON.stringify( {
                "type": "event",
                name,
                args,
            } ) );
    }

    folder ( location, folder, options ) {
        // not a folder
        if ( !statSync( folder ).isDirectory() ) {
            throw Error( `Given path is not a directory "${folder}"` );
        }

        // ensure slash in beginning and no trailing slash for prefix
        if ( location[0] !== "/" ) location = "/" + location;
        if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

        if ( location === "" ) {
            // 301 /index.html -> /
            this.get( "/index.html", async ( res, req ) => {
                res.writeStatus( 301 ).writeHeader( "Location", "/" ).end();
            } );
        }
        else {
            // 301 /location -> /location/
            this.get( location, async ( res, req ) => {
                res.writeStatus( 301 ).writeHeader( "Location", `${location}/` ).end();
            } );

            // 301 /location/index.html -> /location/
            this.get( `${location}/index.html`, async ( res, req ) => {
                res.writeStatus( 301 ).writeHeader( "Location", `${location}/` ).end();
            } );
        }

        this.get( `${location}/`, async ( res, req ) => {
            var path = folder + "/index.html";

            res.sendFile( req, path, options );
        } );

        this.get( `${location}/:path`, async ( res, req ) => {
            var path = req.getParameter( 0 );

            path = folder + "/" + path;

            res.sendFile( req, path, options );
        } );

        return this;
    }

    api ( location, app, options ) {
        if ( !options ) options = {};

        // ensure slash in beginning and no trailing slash for prefix
        if ( location[0] !== "/" ) location = "/" + location;
        if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

        const cfg = {
            "compression": options.compression != null ? options.compression : 0, // 0 = no compression, 1 = shared compressor, 2 = dedicated compressor
            "maxPayloadLength": options.maxPayloadLength != null ? options.maxPayloadLength : 1024 * 1024 * 100,
            "idleTimeout": options.idleTimeout || 60 * 10, // seconds
            "maxBackpressure": options.maxBackpressure, // maximum length of allowed backpressure per socket when publishing messages. Slow receivers, WebSockets, will be disconnected if needed

            ...app.getConnection().getServerConfig(),
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
}

module.exports = class Server extends App {
    constructor ( options ) {
        super( options || {} );

        for ( const name of Object.getOwnPropertyNames( Base.prototype ) ) {
            if ( name === "consstructor" ) continue;

            if ( this[name] ) this["_" + name] = this[name];

            this[name] = Base.prototype[name];
        }
    }
};
