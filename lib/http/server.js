import "#lib/result";
import Events from "#lib/events";
import uws from "@softvisio/uws";
import Request from "./server/request.js";
import path from "path";
import _url from "url";
import env from "#lib/env";
import Connection from "#lib/http/server/connection";

const COMPRESSION = new Set( [

    //
    "DISABLED",

    "SHARED_COMPRESSOR",
    "SHARED_DECOMPRESSOR",

    "DEDICATED_COMPRESSOR_3KB",
    "DEDICATED_COMPRESSOR_4KB",
    "DEDICATED_COMPRESSOR_8KB",
    "DEDICATED_COMPRESSOR_16KB",
    "DEDICATED_COMPRESSOR_32KB",
    "DEDICATED_COMPRESSOR_64KB",
    "DEDICATED_COMPRESSOR_128KB",
    "DEDICATED_COMPRESSOR_256KB",

    "DEDICATED_DECOMPRESSOR",
    "DEDICATED_DECOMPRESSOR_512B",
    "DEDICATED_DECOMPRESSOR_1KB",
    "DEDICATED_DECOMPRESSOR_2KB",
    "DEDICATED_DECOMPRESSOR_4KB",
    "DEDICATED_DECOMPRESSOR_8KB",
    "DEDICATED_DECOMPRESSOR_16KB",
    "DEDICATED_DECOMPRESSOR_32KB",
] );

const DEFAULT_COMPRESSION = ["SHARED_COMPRESSOR", "SHARED_DECOMPRESSOR"];
const DEFAULT_MIN_COMPRESSION_LENGTH = 512;

export default class Server extends Events {
    #uws;

    constructor ( options = {} ) {
        super();

        this.#uws = options.ssl ? uws.SSLApp( options ) : uws.App( options );
    }

    // public
    any ( location, callback ) {
        return this.#method( "any", location, callback );
    }

    get ( location, callback ) {
        return this.#method( "get", location, callback );
    }

    post ( location, callback ) {
        return this.#method( "post", location, callback );
    }

    options ( location, callback ) {
        return this.#method( "options", location, callback );
    }

    delete ( location, callback ) {
        return this.#method( "del", location, callback );
    }

    patch ( location, callback ) {
        return this.#method( "patch", location, callback );
    }

    put ( location, callback ) {
        return this.#method( "put", location, callback );
    }

    head ( location, callback ) {
        return this.#method( "head", location, callback );
    }

    connect ( location, callback ) {
        return this.#method( "connect", location, callback );
    }

    trace ( location, callback ) {
        return this.#method( "trace", location, callback );
    }

    async listen ( addr, port ) {
        return new Promise( resolve => {
            this.#uws.listen( addr, port, token => {
                if ( token ) this.emit( "listening" );

                resolve( result( token ? 200 : 500 ) );
            } );
        } );
    }

    ws ( location, options = {} ) {
        options = { ...options };

        if ( !options.open ) throw Error( `Open callback is required` );

        // seconds, 0 - don't disconnect on timeout
        options.idleTimeout ??= 0;

        // 0 - Disable backpressure check. Internal unsent messages buffer can grow without limit.
        // >0 - Some published or sent messages can be dropped. Need to create more complex code, that will check bufferedAmount before send and continue send after drained. For publishing it is impossible to control this, published messages will be dropped automatically in case of backpressure
        options.maxBackpressure ??= 0;

        options.maxPayloadLength ??= 16 * 1024;

        // sends pings every idleTimeout - 2 secinds, disabled, if idleTimeout is 0
        if ( !options.idleTimeout ) options.sendPingsAutomatically = false;

        if ( !options.compression ) options.compression = "DISABLED";
        else if ( options.compression === true ) options.compression = DEFAULT_COMPRESSION;
        if ( !Array.isArray( options.compression ) ) options.compression = [options.compression];
        let compression;
        options.compression.forEach( value => {
            if ( !COMPRESSION.has( value ) ) throw Error`Invalid compression constant ${value}`;

            if ( compression == null ) compression = uws[value];
            else compression |= uws[value];
        } );

        options.compression = compression;
        const minCompressionLength = options.minCompressionLength ?? DEFAULT_MIN_COMPRESSION_LENGTH;

        // upgrade
        if ( options.upgrade ) {
            const onUpgrade = options.upgrade;

            options.upgrade = ( res, req, context ) => {
                req = new Request( req, res );

                // cache headers
                req.headers;

                onUpgrade( req, context );
            };
        }

        // open
        if ( options.open ) {
            const onOpen = options.open;

            options.open = ws => {
                const connection = options.connection ? options.connection( ws, { minCompressionLength } ) : new Connection( ws, { minCompressionLength } );

                onOpen( connection );
            };
        }

        // close
        options.close = ( ws, status, statusText ) => {
            ws.onClose( result( [status, Buffer.from( statusText ).toString()] ) );
        };

        // message
        options.message = ( ws, data, isBinary ) => {
            ws.onMessage( data, isBinary );
        };

        // ping
        if ( options.ping ) {
            options.ping = ( ws, data ) => {
                ws.onPing( data );
            };
        }

        // pong
        if ( options.pong ) {
            options.pong = ( ws, data ) => {
                ws.onPong( data );
            };
        }

        // drain
        if ( options.drain ) {
            options.drain = ws => {
                ws.onDrain();
            };
        }

        this.#uws.ws( location, options );

        return this;
    }

    publish ( topic, msg, isBunary ) {
        return this.#uws.publish( topic, msg, isBunary );
    }

    numSubscribers ( topic ) {
        return this.#uws.numSubscribers( topic );
    }

    file ( location, file, options = {} ) {
        location = this.#prepareLocation( location );

        file = path.normalize( _url.fileURLToPath( file ) ).replaceAll( "\\", "/" );

        this.get( location, req => {
            req.sendFile( file, options );
        } );

        return this;
    }

    folder ( location, folder, options = {} ) {
        location = this.#prepareLocation( location );

        folder = path.normalize( _url.fileURLToPath( folder ) ).replaceAll( "\\", "/" );

        if ( location === "" ) {

            // 301 /index.html -> /
            this.get( "/index.html", req => {
                req.writeHead( 301, { "Location": "/" } ).end();
            } );
        }
        else {

            // 301 /location -> /location/
            this.get( location, req => {
                req.writeHead( 301, { "Location": `${location}/` } ).end();
            } );

            // 301 /location/index.html -> /location/
            this.get( `${location}/index.html`, req => {
                req.writeHead( 301, { "Location": `${location}/` } ).end();
            } );
        }

        this.get( `${location}/*`, req => {
            const filepath = req.urlDecoded.substring( location.length );

            if ( filepath === path.sep ) {
                req.sendFile( folder + path.sep + "index.html", options );
            }
            else {
                req.sendFile( folder + filepath, options );
            }
        } );

        return this;
    }

    webpack ( location, folder, options = {} ) {
        location = this.#prepareLocation( location );

        folder = path.normalize( _url.fileURLToPath( folder ) ).replaceAll( "\\", "/" );

        const optionsRevalidate = {
                "headers": {
                    "X-Accel-Expires": "@1",
                    "Cache-Control": "public, max-age=0",
                },
            },
            optionsCacheForever = {
                "headers": {
                    "Cache-Control": "public, max-age=30672000, immutable",
                },
            };

        // default item size to compress - 128b
        optionsRevalidate.compress = optionsCacheForever.compress = options.compress != null ? options.compress : 128;

        if ( location === "" ) {

            // 301 /index.html -> /
            this.get( "/index.html", req => {
                req.writeHead( 301, { "Location": "/" } ).end();
            } );
        }
        else {

            // 301 /location -> /location/
            this.get( location, req => {
                req.writeHead( 301, { "Location": `${location}/` } ).end();
            } );

            // 301 /location/index.html -> /location/
            this.get( `${location}/index.html`, req => {
                req.writeHead( 301, { "Location": `${location}/` } ).end();
            } );
        }

        this.get( `${location}/*`, req => {
            const filepath = req.urlDecoded.substring( location.length );

            // index.html - must revalidate
            if ( filepath === path.sep ) {
                req.sendFile( folder + path.sep + "index.html", optionsRevalidate );
            }

            // files from the root dir - must revalidate
            else if ( filepath.indexOf( "/", 1 ) === -1 ) {
                req.sendFile( folder + filepath, optionsRevalidate );
            }

            // files from the sub-directories - cache forever
            else {
                req.sendFile( folder + filepath, optionsCacheForever );
            }
        } );

        return this;
    }

    api ( location, api, options = {} ) {
        location = this.#prepareLocation( location );

        const apiConfig = api.getHttpServerConfig();

        // websocket
        if ( location === "" ) {
            this.ws( "/", apiConfig.ws );
        }
        else {
            this.ws( location, apiConfig.ws );
            this.ws( `${location}/`, apiConfig.ws );
        }

        // options
        if ( env.isDevelopment ) {
            this.options( `${location}/*`, req => {
                req.cork( () => {
                    req.writeHead( 204, {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*",
                        "Access-Control-Allow-Headers": "*, Authorization",
                        "Access-Control-Expose-Headers": "*, Authorization",
                        "Access-Control-Max-Age": 86400, // cache for 24 hours
                    } ).end();
                } );
            } );
        }

        // http post
        this.post( `${location}/*`, req => {

            // get method id
            const methodId = req.urlDecoded.substring( location.length );

            apiConfig.http( req, methodId );
        } );

        // http get
        this.get( `${location}/*`, req => {

            // get method id
            const methodId = req.urlDecoded.substring( location.length );

            apiConfig.http( req, methodId );
        } );

        return this;
    }

    // private
    #method ( method, location, callback ) {
        this.#uws[method]( location, function ( res, req ) {
            req = new Request( req, res );

            callback( req );
        } );

        return this;
    }

    #prepareLocation ( location ) {

        // ensure slash in beginning and no trailing slash for location
        if ( location[0] !== "/" ) location = "/" + location;

        if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

        return location;
    }
}
