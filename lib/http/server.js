import "#lib/result";
import uws from "@softvisio/uws";
import Request from "./server/request.js";
import path from "path";
import _url from "url";
import env from "#lib/env";
import Connection from "#lib/http/server/connection";
import File from "#lib/file";
import { resolve } from "#lib/utils";
import Mutex from "#lib/threads/mutex";
import Signal from "#lib/threads/signal";

const DEFAULT_TRUSTED_SUBNETS = ["private", "google-cloud-load-balancers", "cloudflare"];

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

const DEFAULT_COMPRESS = 1024 * 100; // >= 100k

export default class HttpServer {
    #uws;
    #compress;
    #webSocketCompress;
    #trustedSubnets;

    #listenSocket;
    #address;
    #port;
    #activeResuests = 0;
    #isStopping = false;
    #isStarted = false;
    #startMutex = new Mutex();
    #stopSignal = new Signal();
    #requestEndListener = this.#onRequestEnd.bind( this );

    constructor ( options = {} ) {
        this.#uws = options.ssl ? uws.SSLApp( options ) : uws.App( options );

        this.#compress = options.compress || DEFAULT_COMPRESS;

        this.#webSocketCompress = options.webSocketCompress ?? this.#compress;

        if ( options.trustedSubnets == null ) {
            this.#trustedSubnets = [...DEFAULT_TRUSTED_SUBNETS];
        }
        else if ( typeof options.trustedSubnets === "boolean" ) {
            this.#trustedSubnets = options.trustedSubnets;
        }
        else {
            this.#trustedSubnets = Array.isArray( options.trustedSubnets ) ? options.trustedSubnets : [options.trustedSubnets];
        }
    }

    // properties
    get compress () {
        return this.#compress;
    }

    get webSocketCompress () {
        return this.#webSocketCompress;
    }

    get trustedSubnets () {
        return this.#trustedSubnets;
    }

    get address () {
        return this.#address;
    }

    get posrt () {
        return this.#port;
    }

    get isStarted () {
        return this.#isStarted;
    }

    // public
    async listen ( { address = "127.0.0.1", port = 80, exclusive = true } = {} ) {
        if ( this.#isStopping ) return result( [500, `Server is shitting sown`] );

        if ( this.#isStarted ) {
            return result( 200, {
                "address": this.#address,
                "port": this.#port,
            } );
        }

        if ( !this.#startMutex.tryDown() ) return this.#startMutex.signal.wait();

        const res = new Promise( resolve => {
            this.#uws.listen( address, port, exclusive ? 1 : 0, socket => {
                if ( socket ) {
                    port = uws.us_socket_local_port( socket );

                    this.#listenSocket = socket;
                    this.#address = address;
                    this.#port = port;
                    this.#isStarted = true;

                    resolve( result( 200, { address, port } ) );
                }
                else {
                    resolve( result( 500, { address, port } ) );
                }
            } );
        } );

        this.#startMutex.signal.broadcast( res );
        this.#startMutex.up();

        return res;
    }

    async stop () {
        if ( !this.isStarted ) return;

        this.#isStopping = true;

        // close listen socket
        if ( this.#listenSocket ) {
            uws.us_listen_socket_close( this.#listenSocket );
            this.#listenSocket = null;
        }

        this.#address = null;
        this.#port = null;

        if ( this.#activeResuests ) await this.#stopSignal.wait();

        this.#isStarted = false;
        this.#isStopping = false;
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

    ws ( location, { onUpgrade, createConnection, onConnect, onDisconnect, ping, pong, drain, maxPayloadLength, idleTimeout, sendPingsAutomatically, compress, compression, maxBackpressure } = {} ) {
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

        compress ??= this.webSocketCompress;

        const options = {
            maxPayloadLength,
            idleTimeout,
            sendPingsAutomatically,
            compression,
            maxBackpressure,
        };

        // upgrade
        if ( onUpgrade ) {
            options.upgrade = ( res, req, socketContext ) => {
                req = this.#createRequest( res, req, socketContext );

                if ( !req ) return;

                onUpgrade( req );
            };
        }

        // open
        options.open = ws => {
            if ( createConnection ) {
                ws.connection = createConnection( this, ws, { compress } );
            }
            else {
                ws.connection = new Connection( this, ws, { compress } );
            }

            ws.connection.onConnect();

            if ( onConnect ) onConnect( ws.connection );
        };

        // close
        options.close = ( ws, status, statusText ) => {
            const res = result( [status, Buffer.from( statusText ).toString()] );

            ws.connection.onDisconnect( res );

            if ( onDisconnect ) onDisconnect( ws.connection, res );
        };

        // message
        options.message = ( ws, data, isBinary ) => {
            ws.connection.onMessage( data, isBinary );
        };

        // ping
        if ( ping ) {
            options.ping = ( ws, data ) => {
                ws.connection.onPing( data );
            };
        }

        // pong
        if ( pong ) {
            options.pong = ( ws, data ) => {
                ws.connection.onPong( data );
            };
        }

        // drain
        if ( drain ) {
            options.drain = ws => {
                ws.connection.onDrain();
            };
        }

        this.#uws.ws( location, options );

        return this;
    }

    file ( location, file, options = {} ) {
        options = { ...options };

        location = this.#normalizeLocation( location );

        this.get( location, req => {
            if ( file instanceof File ) {
                req.end( { ...options, "body": file } );
            }
            else {
                req.end( { ...options, "body": new File( { "path": file } ) } );
            }
        } );

        return this;
    }

    directory ( location, directory, options = {} ) {
        options = { ...options };

        location = this.#normalizeLocation( location );

        if ( directory instanceof URL ) directory = _url.fileURLToPath( directory );

        const indexPath = path.join( directory, "index.html" );

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
                req.end( { ...options, "body": new File( { "path": indexPath } ) } );
            }
            else {
                req.end( { ...options, "body": new File( { "path": path.join( directory, filepath ) } ) } );
            }
        } );

        return this;
    }

    webpack ( location, directory, { compress } = {} ) {
        location = this.#normalizeLocation( location );

        if ( directory instanceof URL ) directory = _url.fileURLToPath( directory );

        const indexPath = path.join( directory, "index.html" );

        const optionsRevalidate = {
                compress,
                "headers": {
                    "cache-control": "public, max-age=1",
                },
            },
            optionsCacheForever = {
                compress,
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
                req.end( { ...optionsRevalidate, "body": new File( { "path": indexPath } ) } );
            }

            // files from the root dir - must revalidate
            else if ( filepath.indexOf( "/", 1 ) === -1 ) {
                req.end( { ...optionsRevalidate, "body": new File( { "path": path.join( directory, filepath ) } ) } );
            }

            // files from the sub-directories - cache forever
            else {
                req.end( { ...optionsCacheForever, "body": new File( { "path": path.join( directory, filepath ) } ) } );
            }
        } );

        return this;
    }

    api ( location, { httpCallback, websocketsConfig } = {} ) {
        location = this.#normalizeLocation( location );

        const oauthHtmlPath = resolve( "#resources/oauth.html", import.meta.url );

        // websocket
        if ( location === "" ) {
            this.ws( "/", websocketsConfig );
        }
        else {
            this.ws( location, websocketsConfig );
            this.ws( `${location}/`, websocketsConfig );
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

            httpCallback( req, methodId );
        } );

        // http get
        this.get( `${location}/*`, req => {

            // get method id
            const methodId = req.path.substring( location.length );

            httpCallback( req, methodId );
        } );

        // oauth.html
        this.get( `${location}/oauth.html`, req => {
            req.end( {
                "headers": {
                    "cache-control": "public, max-age=1",
                },
                "body": new File( { "path": oauthHtmlPath } ),
            } );
        } );

        return this;
    }

    // private
    #normalizeLocation ( location ) {

        // ensure slash in beginning and no trailing slash for location
        if ( !location.startsWith( "/" ) ) location = "/" + location;

        if ( location.endsWith( "/" ) ) location = location.slice( 0, -1 );

        return location;
    }

    #method ( method, location, callback ) {
        this.#uws[method]( location, ( res, req ) => {
            req = this.#createRequest( res, req );

            if ( !req ) return;

            callback( req );
        } );

        return this;
    }

    #createRequest ( res, req, socketContext ) {
        req = new Request( this, req, res, socketContext );

        if ( this.#isStopping || !this.#isStarted ) {
            req.close( 502 );

            return;
        }
        else {
            this.#activeResuests++;

            req.on( "end", this.#requestEndListener );

            return req;
        }
    }

    #onRequestEnd () {
        this.#activeResuests--;

        if ( !this.#activeResuests && this.#isStopping ) {
            this.#stopSignal.broadcast();
        }
    }
}
