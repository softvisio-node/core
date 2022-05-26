import "#lib/result";
import Events from "#lib/events";
import uws from "@softvisio/uws";
import Request from "./server/request.js";
import path from "path";
import _url from "url";
import env from "#lib/env";
import Connection from "#lib/http/server/connection";
import File from "#lib/file";

const DEFAULT_REAL_REMOTE_ADDRESS_TRUSTED_SUBNETS = ["private", "google-cloud-load-balancers", "cloudflare"];

const WEBSOCKET_COMPRESSIONS = new Set( [

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

const DEFAULT_WEBSOCKET_MAX_PAYLOAD_LENGTH = 1024 * 16;
const DEFAULT_WEBSOCKET_COMPRESSION = ["SHARED_COMPRESSOR", "SHARED_DECOMPRESSOR"];
const DEFAULT_WEBSOCKET_COMPRESS = 1024 * 512; // >= 512k

export default class Server extends Events {
    #uws;
    #realRemoteAddressTrustedSubnets;

    constructor ( options = {} ) {
        super();

        this.#uws = options.ssl ? uws.SSLApp( options ) : uws.App( options );

        if ( options.realRemoteAddressTrustedSubnets == null ) {
            this.#realRemoteAddressTrustedSubnets = [...DEFAULT_REAL_REMOTE_ADDRESS_TRUSTED_SUBNETS];
        }
        else if ( typeof options.realRemoteAddressTrustedSubnets === "boolean" ) {
            this.#realRemoteAddressTrustedSubnets = options.realRemoteAddressTrustedSubnets;
        }
        else {
            this.#realRemoteAddressTrustedSubnets = Array.isArray( options.realRemoteAddressTrustedSubnets ) ? options.realRemoteAddressTrustedSubnets : [options.realRemoteAddressTrustedSubnets];
        }
    }

    // properties
    get realRemoteAddressTrustedSubnets () {
        return this.#realRemoteAddressTrustedSubnets;
    }

    // public
    async listen ( { address = "127.0.0.1", port = 80 } = {} ) {
        return new Promise( resolve => {
            this.#uws.listen( address, port, socket => {
                if ( socket ) {
                    port = uws.us_socket_local_port( socket );

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

    ws ( location, { upgrade, open, ping, pong, drain, maxPayloadLength, idleTimeout, sendPingsAutomatically, compression, compress, maxBackpressure, connection } = {} ) {
        if ( !open ) throw Error( `Open callback is required` );

        maxPayloadLength ??= DEFAULT_WEBSOCKET_MAX_PAYLOAD_LENGTH;

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
        else if ( compression === true ) compression = DEFAULT_WEBSOCKET_COMPRESSION;

        if ( !Array.isArray( compression ) ) compression = [compression];

        compression = compression.reduce( ( compression, value ) => {
            if ( !WEBSOCKET_COMPRESSIONS.has( value ) ) throw Error`Invalid compression constant ${value}`;

            if ( compression == null ) compression = uws[value];
            else compression |= uws[value];

            return compression;
        }, null );

        if ( compress === true ) compress = DEFAULT_WEBSOCKET_COMPRESS;

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
                req = new Request( this, req, res );

                upgrade( req, context );
            };
        }

        // open
        options.open = ws => {
            ws.connection = connection ? connection( ws, { compress } ) : new Connection( ws, { compress } );

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
        options = { ...options };

        location = this.#normalizeLocation( location );

        this.get( location, req => req.end( new File( { "path": path.normalize( _url.fileURLToPath( file ) ).replaceAll( "\\", "/" ) } ), options ) );

        return this;
    }

    directory ( location, directory, options = {} ) {
        options = { ...options };

        location = this.#normalizeLocation( location );

        directory = this.#normalizeDirectory( directory );

        if ( location === "" ) {

            // 301 /index.html -> /
            this.get( "/index.html", req => {
                req.end( { "status": 301, "headers": { "location": "/" } } );
            } );
        }
        else {

            // 301 /location -> /location/
            this.get( location, req => {
                req.end( { "status": 301, "headers": { "location": `${location}/` } } );
            } );

            // 301 /location/index.html -> /location/
            this.get( `${location}/index.html`, req => {
                req.end( { "status": 301, "headers": { "location": `${location}/` } } );
            } );
        }

        this.get( `${location}/*`, req => {
            const filepath = req.path.substring( location.length );

            if ( filepath === "/" ) {
                req.end( new File( { "path": directory + "/index.html" } ), options );
            }
            else {
                req.end( new File( { "path": directory + filepath } ), options );
            }
        } );

        return this;
    }

    webpack ( location, directory, { compress = true } = {} ) {
        location = this.#normalizeLocation( location );

        directory = this.#normalizeDirectory( directory );

        const optionsRevalidate = {
                "compress": compress,
                "headers": {
                    "cache-control": "public, max-age=1",
                },
            },
            optionsCacheForever = {
                "compress": compress,
                "headers": {
                    "cache-control": "public, max-age=30672000, immutable",
                },
            };

        if ( location === "" ) {

            // 301 /index.html -> /
            this.get( "/index.html", req => {
                req.end( { "status": 301, "headers": { "location": "/" } } );
            } );
        }
        else {

            // 301 /location -> /location/
            this.get( location, req => {
                req.end( { "status": 301, "headers": { "location": `${location}/` } } );
            } );

            // 301 /location/index.html -> /location/
            this.get( `${location}/index.html`, req => {
                req.end( { "status": 301, "headers": { "location": `${location}/` } } );
            } );
        }

        this.get( `${location}/*`, req => {
            const filepath = req.path.substring( location.length );

            // index.html - must revalidate
            if ( filepath === "/" ) {
                req.end( new File( { "path": directory + "/index.html" } ), optionsRevalidate );
            }

            // files from the root dir - must revalidate
            else if ( filepath.indexOf( "/", 1 ) === -1 ) {
                req.end( new File( { "path": directory + filepath } ), optionsRevalidate );
            }

            // files from the sub-directories - cache forever
            else {
                req.end( new File( { "path": directory + filepath } ), optionsCacheForever );
            }
        } );

        return this;
    }

    api ( location, api ) {
        location = this.#normalizeLocation( location );

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
                req.end( {
                    "status": 204,
                    "headers": {
                        "access-control-allow-origin": "*",
                        "access-control-allow-methods": "*",
                        "access-control-allow-headers": "*, Authorization",
                        "access-control-expose-headers": "*, Authorization",
                        "access-control-max-age": 86400, // cache for 24 hours
                    },
                } );
            } );
        }

        // http post
        this.post( `${location}/*`, req => {

            // get method id
            const methodId = req.path.substring( location.length );

            apiConfig.http( req, methodId );
        } );

        // http get
        this.get( `${location}/*`, req => {

            // get method id
            const methodId = req.path.substring( location.length );

            apiConfig.http( req, methodId );
        } );

        return this;
    }

    // private
    #method ( method, location, callback ) {
        this.#uws[method]( location, function ( res, req ) {
            req = new Request( this, req, res );

            callback( req );
        } );

        return this;
    }

    #normalizeLocation ( location ) {

        // ensure slash in beginning and no trailing slash for location
        if ( !location.startsWith( "/" ) ) location = "/" + location;

        if ( location.endsWith( "/" ) ) location = location.slice( 0, -1 );

        return location;
    }

    #normalizeDirectory ( directory ) {
        directory = path.resolve( _url.fileURLToPath( directory ).replaceAll( "\\\\", "/" ) ).replaceAll( "\\", "/" );

        if ( directory.endsWith( "/" ) ) directory = directory.slice( 0, -1 );

        return directory;
    }
}
