const Events = require( "events" );

const PROTOCOL = {

    // static
    "http:": "./type/static",
    "socks:": "./type/static",
    "socks5:": "./type/static",
    "http+socks:": "./type/static",
    "http+socks5:": "./type/static",
    "socks+http:": "./type/static",
    "socks5+http:": "./type/static",

    // dynamic
    "pool:": "./type/pool",
    "tor:": "./type/tor",
};

module.exports = class Proxy extends Events {
    #type;
    #hostname;
    #port;
    #username;
    #password;
    #toString;

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

    // PROPS
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

    get ip () {
        return null;
    }

    set ip ( value ) {}

    get country () {
        return null;
    }

    set country ( value ) {}

    get url () {
        const url = new URL( this.type + "://" );

        url.hostname = this.hostname;
        url.port = this.port;
        url.username = this.username;
        url.password = this.password;

        return url;
    }

    toString () {
        if ( !this.#toString ) this.#toString = this.url.toString();

        return this.#toString;
    }

    _clearToString () {
        this.#toString = null;
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
};
