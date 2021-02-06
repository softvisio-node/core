const Proxy = require( "../proxy" );
const http = require( "http" );
const https = require( "https" );

const tls = require( "tls" );

class HTTPAgent extends http.Agent {
    #agent;

    constructor ( agent ) {
        super( agent.options );

        this.#agent = agent;
    }

    createSocket ( req, options, cb ) {

        // agent has proxy
        if ( this.#agent.proxy ) {
            options.updateHttpRequest = function ( auth ) {
                req.path = req.protocol + "//" + req.host + ":" + ( req.port || 80 ) + req.path;

                if ( auth ) req.setHeader( "Proxy-Authorization", "Basic " + auth );
            };
        }

        return super.createSocket( req, options, cb );
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
                    const servername = options.headers.Host || options.hostname;

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
    #options;
    #httpAgent;
    #httpsAgent;

    // options:
    // proxy: null
    // rejectUnauthorized: true
    constructor ( options = {} ) {
        this.#options = options;

        if ( options.proxy ) this.proxy = options.proxy;
    }

    get options () {
        return this.#options;
    }

    get proxy () {
        return this.#options.proxy;
    }

    set proxy ( proxy ) {
        this.#options.proxy = Proxy.new( proxy );
    }

    get httpAgent () {
        if ( !this.#httpAgent ) this.#httpAgent = new HTTPAgent( this );

        return this.#httpAgent;
    }

    get httpsAgent () {
        if ( !this.#httpsAgent ) this.#httpsAgent = new HTTPsAgent( this );

        return this.#httpsAgent;
    }

    get fetchAgent () {
        return this.#fetchAgent.bind( this );
    }

    #fetchAgent ( url ) {
        if ( url.protocol === "http:" ) return this.httpAgent;
        else return this.httpsAgent;
    }
}

module.exports = HTTPUniversalAgent;
