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

// NOTE https://github.com/sifrr/sifrr/tree/master/packages/server/sifrr-server
function wrapRes ( res ) {
    res._writeStatus = res.writeStatus;
    res.writeStatus = writeStatus;

    res._writeHeader = res.writeHeader;
    res.writeHeader = writeHeader;

    res.sendFile = sendFile;
}

// TODO body handlers, copy from sifrr
// methods with allowed body: "patch", "post", "put"
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

// cache: bool, number
// compress: bool, number
// headers: {}
// zlibOptions: https://nodejs.org/api/zlib.html#zlib_class_options
// fallback: function, in case if file not found
async function sendFile ( req, path, options = {} ) {
    try {
        var stat = await fs.statSync( path );
    }
    catch ( e ) {}

    // file not found or directory
    if ( !stat || !stat.isFile() ) {
        if ( options.fallback ) {
            options.fallback( this, req );
        }
        else {
            this.writeStatus( 404 ).end();
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
            this.writeStatus( 304 ).end();

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

        this.writeStatus( 206 );
    }
    else {
        this.writeStatus( 200 );
    }

    // for size = 0
    if ( end < 0 ) end = 0;

    // compression
    let compressed = false,
        compressor;

    if ( compress ) {
        const accept_encoding = req.getHeader( "accept-encoding" );

        for ( const type in compressions ) {
            if ( accept_encoding.indexOf( type ) > -1 ) {
                compressed = type;

                compressor = compressions[type]( options.zlibOptions );

                headers["Content-Encoding"] = type;

                break;
            }
        }
    }

    this.writeHeader( headers );

    if ( cache ) {
        if ( !CACHE[path] || CACHE[path].mtimeutc !== mtimeutc ) {
            CACHE[path] = { mtimeutc };
        }

        // return from cache
        else if ( CACHE[path][compressed] ) {
            this.end( CACHE[path][compressed] );

            return;
        }
    }

    let readStream = fs.createReadStream( path, { start, end } );

    if ( compressor ) {
        readStream.pipe( compressor );
        readStream = compressor;
    }

    this.onAborted( () => readStream.destroy() );

    readStream.on( "error", ( e ) => {
        this.writeStatus( 500 ).end();

        readStream.destroy();

        throw e;
    } );

    // cache
    if ( cache ) {

        // fill cache
        // TODO how to handle stream errors
        const buffers = [];

        readStream.on( "data", ( buffer ) => {
            buffers.push( buffer );
        } );

        readStream.on( "end", () => {
            CACHE[path][compressed] = Buffer.concat( buffers );

            this.end( CACHE[path][compressed] );
        } );
    }

    // compress
    else if ( compressed ) {
        readStream.on( "data", ( buffer ) => {
            this.write( buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength ) );
        } );

        readStream.on( "end", () => {
            this.end();
        } );
    }

    // regular
    else {
        readStream.on( "data", ( buffer ) => {
            const chunk = buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength ),
                lastOffset = this.getWriteOffset();

            // first try
            const [ok, done] = this.tryEnd( chunk, size );

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
                this.onWritable( ( offset ) => {
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

        readStream.on( "end", () => {
            this.end();
        } );
    }
}

const base = {
    file ( location, file, options ) {
        file = path.normalize( file );

        // ensure slash in beginning and no trailing slash for prefix
        if ( location[0] !== "/" ) location = "/" + location;
        if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

        this.get( location, ( res, req ) => {
            res.sendFile( req, file, options );
        } );

        return this;
    },

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
    },

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
    },

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
    },
};

module.exports = function ( options = {} ) {
    const server = options.ssl ? uws.SSLApp( options ) : uws.App( options );

    // override http methods
    for ( const method of ["any", "get", "post", "options", "del", "patch", "put", "head", "connect", "trace"] ) {
        server["_" + method] = server[method];

        server[method] = function ( location, handler ) {
            this["_" + method]( location, function ( res, req ) {
                wrapRes( res );

                wrapReq( req );

                handler( res, req );
            } );

            return this;
        };
    }

    for ( const method of Object.getOwnPropertyNames( base ) ) {
        server[method] = base[method];
    }

    return server;
};
