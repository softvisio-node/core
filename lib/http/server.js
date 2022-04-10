import "#lib/result";
import Events from "#lib/events";
import uws from "@softvisio/uws";
import Request from "./server/request.js";
import path from "path";
import _url from "url";
import env from "#lib/env";
import Connection from "#lib/http/server/connection";
import { getRandomFreePort } from "#lib/utils/net";

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

const DEFAULT_MAX_PAYLOAD_LENGTH = 1024 * 16;
const DEFAULT_COMPRESSION = ["SHARED_COMPRESSOR", "SHARED_DECOMPRESSOR"];
const DEFAULT_COMPRESS_MESSAGES = 1024 * 512; // >= 512k

export default class Server extends Events {
    #uws;

    constructor ( options = {} ) {
        super();

        this.#uws = options.ssl ? uws.SSLApp( options ) : uws.App( options );
    }

    // public
    async listen ( { address = "127.0.0.1", port = 80 } = {} ) {
        if ( !port ) port = await getRandomFreePort();

        return new Promise( resolve => {
            this.#uws.listen( address, port, socket => {
                if ( socket ) {
                    this.emit( "listening", { address, port } );

                    resolve( result( 200, { address, port } ) );
                }
                else {
                    resolve( result( 500, { address, port } ) );
                }
            } );
        } );
    }

    publish ( topic, msg, isBunary ) {
        return this.#uws.publish( topic, msg, isBunary );
    }

    numSubscribers ( topic ) {
        return this.#uws.numSubscribers( topic );
    }

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

    ws ( location, { upgrade, open, ping, pong, drain, maxPayloadLength, idleTimeout, sendPingsAutomatically, compression, compressMessages, maxBackpressure, connection } = {} ) {
        if ( !open ) throw Error( `Open callback is required` );

        maxPayloadLength ??= DEFAULT_MAX_PAYLOAD_LENGTH;

        // seconds, 0 - don't disconnect on timeout
        idleTimeout ??= 0;

        // sends pings every idleTimeout - 2 secinds, disabled, if idleTimeout is 0
        sendPingsAutomatically ??= true;
        if ( !idleTimeout ) sendPingsAutomatically = false;

        // 0 - Disable backpressure check. Internal unsent messages buffer can grow without limit.
        // >0 - Some published or sent messages can be dropped. Need to create more complex code, that will check bufferedAmount before send and continue send after drained. For publishing it is impossible to control this, published messages will be dropped automatically in case of backpressure
        maxBackpressure ??= 0;

        // compression
        if ( !compression ) compression = "DISABLED";
        else if ( compression === true ) compression = DEFAULT_COMPRESSION;

        if ( !Array.isArray( compression ) ) compression = [compression];

        compression = compression.reduce( ( compression, value ) => {
            if ( !COMPRESSION.has( value ) ) throw Error`Invalid compression constant ${value}`;

            if ( compression == null ) compression = uws[value];
            else compression |= uws[value];

            return compression;
        }, null );

        compressMessages ??= DEFAULT_COMPRESS_MESSAGES;

        const options = {
            maxPayloadLength,
            idleTimeout,
            sendPingsAutomatically,
            compression,
            maxBackpressure,
            connection,
        };

        // upgrade
        if ( upgrade ) {
            options.upgrade = ( res, req, context ) => {
                req = new Request( req, res );

                // cache headers
                req.headers;

                upgrade( req, context );
            };
        }

        // open
        options.open = ws => {
            ws.connection = connection ? connection( ws, { compressMessages } ) : new Connection( ws, { compressMessages } );

            open( ws.connection );
        };

        // close
        options.close = ( ws, status, statusText ) => {
            ws.connection._onClose( result( [status, Buffer.from( statusText ).toString()] ) );
        };

        // message
        options.message = ( ws, data, isBinary ) => {
            ws.connection._onMessage( data, isBinary );
        };

        // ping
        if ( ping ) {
            options.ping = ( ws, data ) => {
                ws.connection._onPing( data );
            };
        }

        // pong
        if ( pong ) {
            options.pong = ( ws, data ) => {
                ws.connection._onPong( data );
            };
        }

        // drain
        if ( drain ) {
            options.drain = ws => {
                ws.connection._onDrain();
            };
        }

        this.#uws.ws( location, options );

        return this;
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

            if ( filepath === "/" ) {
                req.sendFile( folder + "/index.html", options );
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
            if ( filepath === "/" ) {
                req.sendFile( folder + "/index.html", optionsRevalidate );
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
