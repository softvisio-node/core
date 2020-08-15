const createProxy = require( "../proxy" );
const http = require( "http" );
const https = require( "https" );

const tls = require( "tls" );

class HTTPAgent extends http.Agent {
    #agent;

    constructor ( agent, options = {} ) {
        super( options );

        this.#agent = agent;
    }

    addRequest ( req, options ) {
        if ( this.#agent.proxy ) {
            const type = this.#agent.proxy.getConnectionType( options.protocol );

            if ( type === "http" ) {
                req.path = options.protocol + "//" + options.host + ":" + options.port + options.path;

                if ( this.#agent.proxy.basicAuth ) req.setHeader( "Proxy-Authorization", "Basic " + this.#agent.proxy.basicAuth );
            }
        }

        return super.addRequest( req, options );
    }

    createConnection ( options, callback ) {

        // proxied connection
        if ( this.#agent.proxy ) {
            this.#agent.proxy
                .connect( options )
                .then( socket => callback( null, socket ) )
                .catch( callback );
        }

        // direct connection
        else {
            return super.createConnection( options, callback );
        }
    }
}

class HTTPsAgent extends https.Agent {
    #agent;

    constructor ( agent, options = {} ) {
        super( options );

        this.#agent = agent;
    }

    createConnection ( options, callback ) {

        // proxied connection
        if ( this.#agent.proxy ) {
            this.#agent.proxy
                .connect( options )
                .then( socket => {

                    // upgrade socket to TLS
                    const tlsSocket = tls.connect( { "socket": socket, "host": options.headers.Host || options.hostname } );

                    tlsSocket.once( "end", () => callback( "TLS connection closed" ) );

                    tlsSocket.once( "error", callback );

                    tlsSocket.once( "secureConnect", () => {
                        tlsSocket.connectionType = socket.connectionType;

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

class HTTPUniversalAgent {
    #proxy;
    #httpAgent;
    #httpsAgent;
    #nodeFetchAgent;

    constructor ( options = {} ) {
        if ( options.proxy ) this.proxy = options.proxy;
    }

    get proxy () {
        return this.#proxy;
    }

    set proxy ( proxy ) {
        this.#proxy = createProxy( proxy );
    }

    get nodeFetchAgent () {
        if ( !this.#nodeFetchAgent ) {
            this.#nodeFetchAgent = url => {
                if ( url.protocol === "http:" ) {
                    if ( !this.#httpAgent ) this.#httpAgent = new HTTPAgent( this );

                    return this.#httpAgent;
                }
                else {
                    if ( !this.#httpsAgent ) this.#httpsAgent = new HTTPsAgent( this );

                    return this.#httpsAgent;
                }
            };
        }

        return this.#nodeFetchAgent;
    }
}

module.exports = HTTPUniversalAgent;
