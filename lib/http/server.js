import "#index";

import uws from "@softvisio/uws";
import Request from "./server/request.js";
import path from "path";
import _url from "url";

const DEFAULT_IDLE_TIMEOUT = 40; // 40 seconds for cloudflare
const DEFAULT_MAX_PAYLOAD_LENGTH = 1024 * 1024 * 10; // 10M

function prepareLocation ( location ) {

    // ensure slash in beginning and no trailing slash for location
    if ( location[0] !== "/" ) location = "/" + location;

    if ( location[location.length - 1] === "/" ) location = location.slice( 0, -1 );

    return location;
}

const OVERRIDE = new Set( ["any", "get", "post", "options", "del", "patch", "put", "head", "connect", "trace"] );

const METHODS = {
    file ( location, file, options = {} ) {
        location = prepareLocation( location );

        file = path.normalize( _url.fileURLToPath( file ) );

        this.get( location, req => {
            req.sendFile( file, options );
        } );

        return this;
    },

    folder ( location, folder, options = {} ) {
        location = prepareLocation( location );

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
    },

    webpack ( location, folder, options = {} ) {
        location = prepareLocation( location );

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
    },

    api ( location, api, options = {} ) {
        location = prepareLocation( location );

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
        if ( process.env.NODE_ENV === "development" ) {
            this.options( `${location}/*`, req => {
                req.cork( () => {
                    req.writeHead( 204, {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*",
                        "Access-Control-Allow-Headers": "*",
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
    },
};

export default class Server {
    constructor ( options = {} ) {
        const server = options.ssl ? uws.SSLApp( options ) : uws.App( options );

        // eslint-disable-next-line no-constructor-return
        return new Proxy( server, {
            get ( target, prop, receiver ) {

                // override default methods
                if ( OVERRIDE.has( prop ) ) {
                    return function ( location, handler ) {
                        target[prop]( location, function ( res, req ) {
                            req = new Request( req, res );

                            handler( req );
                        } );

                        return this;
                    };
                }

                // additional methods
                else if ( prop in METHODS ) {
                    return METHODS[prop];
                }
                else if ( prop === "listen" ) {
                    return async function ( addr, port, log ) {
                        return new Promise( resolve => {
                            server.listen( addr, port, token => {
                                const res = result( token ? 200 : 500 );

                                if ( log ) {
                                    if ( res.ok ) console.log( `Listening ... ${addr}:${port}` );
                                    else console.log( `Listening ... error listen ${addr}:${port}` );
                                }

                                resolve( res );
                            } );
                        } );
                    };
                }

                // default
                else {
                    const orig = server[prop];

                    if ( typeof orig === "function" ) return orig.bind( server );

                    return orig;
                }
            },
        } );
    }
}
