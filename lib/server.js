const { App } = require( "uws" );
const fs = require( "./fs" );
const STATUS = fs.config.read( __dirname + "/../resources/status.json" );
const { createBrotliCompress, createGzip, createDeflate } = require( "zlib" );

const bytes = "bytes=";

const compressions = {
    "br": createBrotliCompress,
    "gzip": createGzip,
    "deflate": createDeflate,
};

function wrapRes ( res ) {
    res._writeStatus = res.writeStatus;
    res.writeStatus = writeStatus;

    res._writeHeader = res.writeHeader;
    res.writeHeader = writeHeader;

    res.sendFile = sendFile;
}

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

async function sendFile ( req, path, options ) {
    try {
        var stat = fs.statSync( path );
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
        "accept-encoding": req.getHeader( "accept-encoding" ),
    };

    var headers = {};

    // return 304 if last-modified
    if ( reqHeaders["if-modified-since"] ) {
        if ( new Date( reqHeaders["if-modified-since"] ) >= mtime ) {
            this.writeStatus( 304 ).end();

            return;
        }
    }

    headers["last-modified"] = mtimeutc;

    // headers["content-type"] = getMime( path );

    // write data
    let start = 0,
        end = size - 1;

    // if ( reqHeaders.range ) {
    //     compress = false;

    //     const parts = reqHeaders.range.replace( bytes, "" ).split( "-" );

    //     start = parseInt( parts[0], 10 );

    //     end = parts[1] ? parseInt( parts[1], 10 ) : end;

    //     headers["accept-ranges"] = "bytes";

    //     headers["content-range"] = `bytes ${start}-${end}/${size}`;

    //     size = end - start + 1;

    //     this.writeStatus( 206 );
    // }

    // for size = 0
    if ( end < 0 ) end = 0;

    const readStream = fs.createReadStream( path, { start, end } );

    // compression
    // let compressed: boolean | string = false;

    // if ( compress ) {
    //     const l = compressionOptions.priority.length;

    //     for ( let i = 0; i < l; i++ ) {
    //         const type = compressionOptions.priority[i];

    //         if ( reqHeaders["accept-encoding"].indexOf( type ) > -1 ) {
    //             compressed = type;
    //             const compressor = compressions[type]( compressionOptions );
    //             readStream.pipe( compressor );
    //             readStream = compressor;
    //             headers["content-encoding"] = compressionOptions.priority[i];
    //             break;
    //         }
    //     }
    // }

    this.onAborted( () => readStream.destroy() );

    this.writeHeaders( headers );

    readStream.on( "data", ( buffer ) => {
        const chunk = buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength ),
            lastOffset = this.getWriteOffset();

        // First try
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

    readStream
        .on( "error", ( e ) => {
            this.writeStatus( 500 );

            this.end();

            readStream.destroy();

            throw e;
        } )
        .on( "end", () => {
            this.end();
        } );
}

class Base {
    get ( location, handler ) {
        return this._get( location, ( res, req ) => {
            wrapRes( res );

            handler( res, req );
        } );
    }

    folder ( location, folder, options ) {
        // not a folder
        if ( !fs.statSync( folder ).isDirectory() ) {
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

            res.sendFile( req, path );
        } );

        this.get( `${location}/:path`, async ( res, req ) => {
            var path = req.getParameter( 0 );

            path = folder + "/" + path;

            res.sendFile( req, path );
        } );

        return this;
    }

    api ( location, api ) {
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
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 6:7           | no-unused-vars               | 'bytes' is assigned a value but never used.                                    |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 8:7           | no-unused-vars               | 'compressions' is assigned a value but never used.                             |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 90:9          | prefer-const                 | 'start' is never reassigned. Use 'const' instead.                              |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
