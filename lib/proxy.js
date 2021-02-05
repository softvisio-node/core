const PROTOCOL = {

    // static
    "http:": "./proxy/static",
    "socks:": "./proxy/static",
    "socks5:": "./proxy/static",
    "http+socks:": "./proxy/static",
    "http+socks5:": "./proxy/static",
    "socks+http:": "./proxy/static",
    "socks5+http:": "./proxy/static",

    // dynamic
    "pool:": "./proxy/dynamic/pool",
    "tor:": "./proxy/dynamic/tor",
};

class Proxy {
    #type;
    #hostname;
    #port;
    #username;
    #password;

    static new ( url, options = {} ) {
        if ( !url ) return;

        // url is proxy object
        if ( url instanceof Proxy ) return url;

        // url is string
        if ( typeof url === "string" ) {
            if ( url.indexOf( "//" ) === -1 ) url = "http://" + url;

            url = new URL( url );
        }

        let Class = PROTOCOL[url.protocol];

        if ( !Class ) throw `Proxy protocol ${url.protocol} is not registered`;

        if ( typeof Class === "string" ) {
            Class = require( Class );

            PROTOCOL[url.protocol] = Class;
        }

        return new Class( url, options );
    }

    static register ( protocol, Class ) {
        if ( !protocol.endsWith( ":" ) ) protocol = protocol + ":";

        PROTOCOL[protocol] = Class;
    }

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        this.#type = url.protocol.slice( 0, -1 );
        this.#hostname = options.hostname || url.hostname || "";
        this.#port = options.port || url.port || "";
        this.#username = options.username || url.username || "";
        this.#password = options.password || url.password || "";
    }

    get type () {
        return this.#type;
    }

    get hostname () {
        return this.#hostname;
    }

    get port () {
        return this.#port;
    }

    get username () {
        return this.#username;
    }

    get password () {
        return this.#password;
    }

    getConnectionType ( protocol ) {
        if ( this.isHttp ) {
            if ( protocol === "http:" ) return "http";

            if ( protocol === "https:" ) return "https";
        }

        // fallback to socks5 protocol
        if ( this.isSocks ) return "socks5";
    }
}

module.exports = function ( url, options ) {
    return Proxy.new( url, options );
};

module.exports.registerProxy = function ( protocol, Class ) {
    return Proxy.register( protocol, Class );
};

module.exports.Proxy = Proxy;
