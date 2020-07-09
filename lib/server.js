const uws = require( "uws" );
const fs = require( "./fs" );
const { createBrotliCompress, createGzip, createDeflate } = require( "zlib" );
const STATUS = fs.config.read( __dirname + "/../resources/status.json" );
const mime = require( "./mime" );
const path = require( "path" );
const bytes = "bytes=";
const Lru = require( "lru-cache" );
const compressions = {
    "gzip": createGzip,
    "br": createBrotliCompress,
    "deflate": createDeflate,
};

var cacheItemId = 0;

// NOTE https://github.com/sifrr/sifrr/tree/master/packages/server/sifrr-server
function wrapRes ( res ) {
    res._writeStatus = res.writeStatus;
    res.writeStatus = writeStatus;

    res._writeHeader = res.writeHeader;
    res.writeHeader = writeHeader;

    res.sendFile = sendFile;
    res.sendBuffer = sendBuffer;
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

// cache: optional, instance of lru-cache;
// maxCacheItemSize: bool, number - max item length to cache
// compress: bool, number
// headers: {}
// zlibOptions: https://nodejs.org/api/zlib.html#zlib_class_options
// fallback: function( res, req ), in case if file not found
function sendFile ( req, path, options = {} ) {
    try {
        var stat = fs.statSync( path );
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

    // prepare mtimeutc
    var { mtime, size } = stat;
    mtime.setMilliseconds( 0 );
    const mtimeutc = mtime.toUTCString();

    var reqHeaders = {
        "if-modified-since": req.getHeader( "if-modified-since" ),
        "range": req.getHeader( "range" ),
    };

    // return 304 if last-modified
    if ( reqHeaders["if-modified-since"] ) {
        if ( new Date( reqHeaders["if-modified-since"] ) >= mtime ) {
            this.writeStatus( 304 ).end();

            return;
        }
    }

    var compress = !options.compress ? false : options.compress === true ? true : size >= options.compress,
        headers = options.headers ? { ...options.headers } : {};

    headers["Last-Modified"] = mtimeutc;

    // mime
    const mimeType = mime.getByExtname( path );
    if ( mimeType ) {
        if ( !mimeType.compressible ) compress = false;

        headers["Content-Type"] = mimeType["content-type"];
    }

    // cache
    var cache, cachedItem;

    // use cache
    if ( options.cache && options.maxCacheItemSize ) {

        // cache any size
        if ( options.maxCacheItemSize === true ) {
            cache = true;
        }

        // size constraint is passed
        else if ( size <= options.maxCacheItemSize ) {
            cache = true;
        }

        // size is greater, remove item from cache
        else {
            options.cache.del( path );
        }
    }

    // write data
    let start = 0,
        end = size - 1;

    // range
    if ( reqHeaders.range ) {

        // do not cache partial content
        cache = false;

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

    // use cahe
    if ( cache ) {
        cachedItem = options.cache.get( path );

        // file not cached or was updated
        if ( !cachedItem || cachedItem.mtimeutc !== mtimeutc ) {
            cachedItem = { mtimeutc };

            options.cache.set( path, cachedItem );
        }

        // file is cached and has required content, retur from cache
        else if ( cachedItem[compressed] ) {
            this.sendBuffer( cachedItem[compressed] );

            return;
        }

        // register on item cached callback
        const key = "on_ready_" + compressed;

        let readToCache;

        if ( !cachedItem[key] ) {
            cachedItem[key] = {};

            readToCache = true;
        }

        const id = cacheItemId++;

        cachedItem[key][id] = buffer => {
            this.sendBuffer( buffer );
        };

        if ( !readToCache ) {
            this.onAborted( () => {
                delete cachedItem[key][id];
            } );

            return;
        }
    }

    let readStream = fs.createReadStream( path, { start, end } );

    if ( compressor ) {
        readStream.pipe( compressor );
        readStream = compressor;
    }

    this.onAborted( () => readStream.destroy() );

    readStream.on( "error", e => {
        this.writeStatus( 500 ).end();

        readStream.destroy();

        throw e;
    } );

    // cache
    if ( cache ) {
        const buffers = [];

        // read to cache
        readStream.on( "data", buffer => {
            buffers.push( buffer );
        } );

        // TODO how to handle stream errors
        readStream.on( "end", () => {
            cachedItem[compressed] = Buffer.concat( buffers );

            const key = "on_ready_" + compressed;

            for ( const id in cachedItem[key] ) {
                cachedItem[key][id]( cachedItem[compressed] );

                delete cachedItem[key][id];
            }

            delete cachedItem[key];
        } );
    }

    // compress, we don't know compressed file size, so can only use chunked transfer
    else if ( compressed ) {
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

function sendBuffer ( buffer ) {

    // ???
    // buffer = buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );

    const size = buffer.length;

    // all data sent
    if ( this.tryEnd( buffer, size )[1] ) return;

    // register onAborted, because we will send data asynchronously
    this.onAborted( () => {} );

    // back-pressure
    this.onWritable( offset => this.tryEnd( buffer.slice( offset ), size )[0] );
}

const base = {
    file ( location, file, options = {} ) {
        file = path.normalize( file );

        // ensure slash in beginning and no trailing slash for prefix
        if ( location[0] !== "/" ) location = "/" + location;
        if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

        // copy options
        options = { ...options };

        // do not use cache
        if ( !options.maxCacheItemSize ) {
            delete options.cache;
        }

        // use server shared cache
        else if ( !options.cache ) {
            options.cache = this.cache;
        }

        // use private cache
        else if ( typeof options.cache === "number" ) {
            options.cache = new Lru( {
                "max": options.cache,
            } );
        }

        this.get( location, ( res, req ) => {
            res.sendFile( req, file, options );
        } );

        return this;
    },

    // maxCacheItemSize: false - do not use cache, number - max size of file
    // cache: false - use server shared cache, number - max size of private cache, instance of lru-cache
    folder ( location, folder, options = {} ) {
        folder = path.normalize( folder );

        // ensure slash in beginning and no trailing slash for prefix
        if ( location[0] !== "/" ) location = "/" + location;
        if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

        // copy options
        options = { ...options };

        // do not use cache
        if ( !options.maxCacheItemSize ) {
            delete options.cache;
        }

        // use server shared cache
        else if ( !options.cache ) {
            options.cache = this.cache;
        }

        // use private cache
        else if ( typeof options.cache === "number" ) {
            options.cache = new Lru( {
                "max": options.cache,
            } );
        }

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
                "headers": {
                    "Cache-Control": "public, private, must-revalidate, proxy-revalidate",
                },
            },
            optionsOther = {
                "headers": {
                    "Cache-Control": "public, max-age=30672000",
                },
            };

        // default max item size - 10M
        optionsIndex.maxCacheItemSize = optionsOther.maxCacheItemSize = typeof options.maxCacheItemSize !== "undefined" ? options.maxCacheItemSize : 1024 * 1024 * 10;

        // default item size to compress - 128b
        optionsIndex.compress = optionsOther.compress = options.compress != null ? options.compress : 128;

        // use cache
        if ( optionsIndex.maxCacheItemSize ) {

            // default value, private cache, 10k items max
            if ( typeof options.cache == "undefined" ) {
                optionsIndex.cache = optionsOther.cache = new Lru( {
                    "max": 10000,
                } );
            }

            // use server shared cache
            else if ( !options.cache ) {
                optionsIndex.cache = optionsOther.cache = this.cache;
            }

            // use private cache
            else if ( typeof options.cache === "number" ) {
                optionsIndex.cache = optionsOther.cache = new Lru( {
                    "max": options.cache,
                } );
            }

            // lru-cache instance
            else {
                optionsIndex.cache = optionsOther.cache = options.cache;
            }
        }

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

// ssl: bool - use ssl
// cache: false - no cache, number - max size of shared cache, instance of lru-cache
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

    if ( options.cache ) {

        // max lru-cache size
        if ( typeof options.cache === "number" ) {
            server.cache = new Lru( {
                "max": options.cache,
            } );
        }

        // instance of lru-cache
        else {
            server.cache = options.cache;
        }
    }

    return server;
};
