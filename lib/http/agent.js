import ProxyClient from "#lib/proxy";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { cookies as globalCookies } from "#lib/http/cookies";

class HttpAgent extends http.Agent {
    #agent;

    // public
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
                    callback( null, socket );
                } )
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

    // public
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
                        socket,
                        "host": servername,
                        servername,
                    } );

                    tlsSocket.once( "end", () => callback( "TLS connection closed" ) );

                    tlsSocket.once( "error", callback );

                    tlsSocket.once( "secureConnect", () => {
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

    // properties
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

    // private
    #fetchAgent ( url ) {
        if ( url.protocol === "http:" ) {
            return this.httpAgent;
        }
        else {
            if ( url.protocol === "https:" ) return this.httpsAgent;
        }
    }
}
