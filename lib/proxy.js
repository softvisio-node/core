const Events = require( "events" );

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

class Proxy extends Events {
    #id;
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

        const protocol = options.protocol || url.protocol;

        let Class = PROTOCOL[protocol];

        if ( !Class ) throw `Proxy protocol ${protocol} is not registered`;

        if ( typeof Class === "string" ) {
            Class = require( Class );

            PROTOCOL[protocol] = Class;
        }

        return new Class( url, options );
    }

    static register ( protocol, Class ) {
        if ( !protocol.endsWith( ":" ) ) protocol = protocol + ":";

        PROTOCOL[protocol] = Class;
    }

    constructor ( url, options = {} ) {
        super();

        if ( typeof url === "string" ) url = new URL( url );

        this.#type = ( options.protocol || url.protocol ).slice( 0, -1 );
        this.#hostname = options.hostname || url.hostname || "";
        this.#port = options.port || url.port || "";
        this.#username = options.username || url.username || "";
        this.#password = options.password || url.password || "";
    }

    get id () {
        if ( !this.#id ) this.#id = this.hostname + ":" + this.port;

        return this.#id;
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

    get _url () {
        const url = new URL( this.type + "://" );

        url.hostname = this.hostname;
        url.port = this.port;
        url.username = this.username;
        url.password = this.password;

        return url;
    }

    getConnectionType ( protocol ) {
        if ( protocol === "http:" || protocol === "https:" ) {
            if ( this.isHttp ) return "http";
            else if ( this.isSocks ) return "socks";
        }
        else {
            if ( this.isSocks ) return "socks";
        }
    }
}

module.exports = function ( url, options ) {
    return Proxy.new( url, options );
};

module.exports.registerProxy = function ( protocol, Class ) {
    return Proxy.register( protocol, Class );
};

module.exports.Proxy = Proxy;
