const http = require( "http" );
const https = require( "https" );

const tls = require( "tls" );

class HTTPAgent extends http.Agent {
    #agent;

    constructor ( agent, options = {} ) {
        super( options );

        this.#agent = agent;
    }

    // TODO replace headers
    addRequest ( req, options ) {
        if ( this.#agent.proxy && this.#agent.proxy.basicAuth ) {
            req.setHeader( "Proxy-Authorization", "Basic " + this.#agent.proxy.basicAuth );
        }

        return super.addRequest( req, options );
    }

    createConnection ( options, callback ) {
        if ( this.#agent.proxy ) {
            this.#agent.proxy.connect( "http://" + options.hostname + ":" + options.port ).then( socket => {
                callback( null, socket );
            } );
        }
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
        if ( this.#agent.proxy ) {
            this.#agent.proxy.connect( "http://" + options.hostname + ":" + options.port ).then( socket => {
                const tlsSocket = tls.connect( { "socket": socket, "host": options.hostname }, function () {
                    callback( null, tlsSocket );
                } );
            } );
        }
        else {
            return super.createConnection( options, callback );
        }
    }
}

class HTTPUnivarsalAgent {
    #proxy;
    #httpAgent;
    #httpsAgent;
    #nodeFetchAgent;

    constructor ( options = {} ) {
        if ( options.proxy ) this.#proxy = options.proxy;
    }

    get proxy () {
        return this.#proxy;
    }

    set proxy ( proxy ) {
        this.#proxy = proxy;
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

module.exports = HTTPUnivarsalAgent;
