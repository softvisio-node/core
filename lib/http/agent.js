import ProxyClient from "#lib/proxy";
import http from "http";
import https from "https";
import tls from "tls";
import { cookies as globalCookies } from "#lib/http/cookies";

class HttpAgent extends http.Agent {
    #agent;

    constructor ( agent ) {
        super( agent.options );

        this.#agent = agent;
    }

    createSocket ( req, options, cb ) {

        // agent has proxy
        if ( this.#agent.proxy ) {

            // XXX DIRTY HACK!!!
            // need to defer req.end() until socket will be ready
            let end, body;

            req.end = function ( chunk, encoding, callback ) {
                end = true;
            };

            req.write = ( chunk, encoding, callback ) => {
                body = [chunk, encoding, callback];
            };

            options.updateHttpGetRequest = function ( _options = {} ) {
                if ( _options.http ) {
                    if ( _options.hostname ) {
                        const url = new URL( options.href );
                        url.hostname = _options.hostname;
                        req.path = url.href;
                    }
                    else {
                        req.path = options.href;
                    }

                    if ( _options.auth ) req.setHeader( "Proxy-Authorization", "Basic " + _options.auth );
                }

                delete req.end;
                delete req.write;
                if ( body ) req.write( ...body );
                if ( end ) req.end();
            };
        }

        return super.createSocket( req, options, cb );
    }

    createConnection ( options, callback ) {

        // proxied connection
        if ( this.#agent.proxy ) {
            const updateHttpGetRequest = options.updateHttGetpRequest;
            delete options.updateHttpGetRequest;

            this.#agent.proxy
                .connect( options, {}, updateHttpGetRequest )
                .then( socket => callback( null, socket ) )
                .catch( callback );
        }

        // direct connection
        else {
            return super.createConnection( options, callback );
        }
    }
}

class HttpsAgent extends https.Agent {
    #agent;

    constructor ( agent ) {
        super( agent.options );

        this.#agent = agent;
    }

    createConnection ( options, callback ) {

        // proxied connection
        if ( this.#agent.proxy ) {
            this.#agent.proxy
                .connect( options )
                .then( socket => {
                    const servername = options.headers?.Host || options.headers?.host || options.hostname;

                    // upgrade socket to TLS
                    const tlsSocket = tls.connect( {
                        ...this.options,
                        "socket": socket,
                        "host": servername,
                        servername,
                    } );

                    tlsSocket.once( "end", () => callback( "TLS connection closed" ) );

                    tlsSocket.once( "error", callback );

                    tlsSocket.once( "secureConnect", () => {
                        tlsSocket.proxyConnectionType = socket.proxyConnectionType;

                        tlsSocket.removeAllListeners();

                        callback( null, tlsSocket );
                    } );
                } )
                .catch( callback );
        }

        // direct connection
        else {
            return super.createConnection( options, callback );
        }
    }
}

export default class HttpUniversalAgent {
    #options;
    #httpAgent;
    #httpsAgent;
    #cookies;

    // options:
    // proxy: null
    // rejectUnauthorized: true
    constructor ( options = {} ) {
        this.#options = options;

        if ( options.proxy ) this.proxy = options.proxy;

        if ( options.cookies ) {
            this.#cookies = options.cookies;

            if ( this.#cookies === true ) this.#cookies = globalCookies;
        }
    }

    get options () {
        return this.#options;
    }

    get proxy () {
        return this.#options.proxy;
    }

    set proxy ( proxy ) {
        this.#options.proxy = ProxyClient.new( proxy );
    }

    get cookies () {
        return this.#cookies;
    }

    get httpAgent () {
        this.#httpAgent ??= new HttpAgent( this );

        return this.#httpAgent;
    }

    get httpsAgent () {
        this.#httpsAgent ??= new HttpsAgent( this );

        return this.#httpsAgent;
    }

    get fetchAgent () {
        return this.#fetchAgent.bind( this );
    }

    #fetchAgent ( url ) {
        if ( url.protocol === "http:" ) return this.httpAgent;
        else if ( url.protocol === "https:" ) return this.httpsAgent;
    }
}
