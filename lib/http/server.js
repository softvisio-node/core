import "#lib/result";
import Events from "#lib/events";
import uws from "@softvisio/uws";
import Request from "./server/request.js";
import path from "path";
import _url from "url";
import env from "#lib/env";

const DEFAULT_IDLE_TIMEOUT = 40; // 40 seconds for cloudflare
const DEFAULT_MAX_PAYLOAD_LENGTH = 1024 * 1024 * 10; // 10M

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

        file = path.normalize( _url.fileURLToPath( file ) );

        this.get( location, req => {
            req.sendFile( file, options );
        } );

        return this;
    }

    folder ( location, folder, options = {} ) {
        location = this.#prepareLocation( location );

        folder = path.normalize( _url.fileURLToPath( folder ) );

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
            const filepath = req.urlDecoded.substr( location.length );

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

        folder = path.normalize( _url.fileURLToPath( folder ) );

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
            const filepath = req.urlDecoded.substr( location.length );

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

        const cfg = {
            "idleTimeout": options.idleTimeout, // seconds, 0 - don't disconnect on timeout
            "compression": options.compression, // 0 = no compression, 1 = shared compressor (recommended), 2 = dedicated compressor
            "maxPayloadLength": options.maxPayloadLength,

            ...apiConfig.ws,
        };

        cfg.idleTimeout ??= DEFAULT_IDLE_TIMEOUT;

        // no compression
        if ( !cfg.compresion ) cfg.compression = 0;
        else if ( cfg.compresion === true ) cfg.compression = 1; // shared compression

        cfg.maxPayloadLength ||= DEFAULT_MAX_PAYLOAD_LENGTH;

        // websocket
        if ( location === "" ) {
            this.ws( "/", cfg );
        }
        else {
            this.ws( location, cfg );
            this.ws( `${location}/`, cfg );
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
            const methodId = req.urlDecoded.substr( location.length );

            apiConfig.http( req, methodId );
        } );

        // http get
        this.get( `${location}/*`, req => {

            // get method id
            const methodId = req.urlDecoded.substr( location.length );

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
