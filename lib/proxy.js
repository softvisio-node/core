const Events = require( "events" );

const PROTOCOL = {

    // static
    "http:": "./proxy/type/static",
    "socks:": "./proxy/type/static",
    "socks5:": "./proxy/type/static",
    "http+socks:": "./proxy/type/static",
    "http+socks5:": "./proxy/type/static",
    "socks+http:": "./proxy/type/static",
    "socks5+http:": "./proxy/type/static",

    // dynamic
    "hola:": "./proxy/type/hola",
    "hola-static:": "./proxy/type/hola/static",
    "local-static:": "./proxy/type/local/static",
    "local-subnet:": "./proxy/type/local/subnet",
    "luminati:": "./proxy/type/luminati",
    "packetstream:": "./proxy/type/packetstream",
    "pool:": "./proxy/type/pool",
    "tor:": "./proxy/type/tor",
};

module.exports = class Proxy extends Events {
    #protocol;
    #hostname = "";
    #port = "";
    #username = "";
    #password = "";
    #basicAuth;
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

        if ( !Class ) throw `Proxy protocol "${protocol}" is not registered`;

        if ( typeof Class === "string" ) {
            Class = require( Class );

            PROTOCOL[protocol] = Class;
        }

        const proxy = new Class();

        proxy.$init( url, options );

        return proxy;
    }

    static register ( protocol, Class ) {
        if ( !protocol.endsWith( ":" ) ) protocol = protocol + ":";

        PROTOCOL[protocol] = Class;
    }

    static get server () {
        const ProxyServer = require( "./proxy/server" );

        return ProxyServer;
    }

    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super.$init ) super.$init( url, options );

        this.#protocol = options.protocol || url.protocol;
        this.#hostname = options.hostname || url.hostname;
        this.#port = options.port || url.port;
        this.#username = options.username || url.username;
        this.#password = options.password || url.password;
    }

    // PROPS
    get protocol () {
        return this.#protocol;
    }

    get hostname () {
        return this.#hostname;
    }

    set hostname ( value ) {
        value ||= "";

        // not updated
        if ( this.#hostname === value ) return;

        this.#hostname = value;

        this._updated();
    }

    get port () {
        return this.#port;
    }

    set port ( value ) {
        value ||= "";

        // not updated
        if ( this.#port === value ) return;

        this.#port = value;

        this._updated();
    }

    get username () {
        return this.#username;
    }

    set username ( value ) {
        value ||= "";

        // not updated
        if ( this.#username === value ) return;

        this.#username = value;

        this.#basicAuth = null;
        this._updated();
    }

    get password () {
        return this.#password;
    }

    set password ( value ) {
        value ||= "";

        // not updated
        if ( this.#password === value ) return;

        this.#password = value;

        this.#basicAuth = null;
        this._updated();
    }

    get basicAuth () {
        if ( this.#basicAuth == null && ( this.username !== "" || this.password !== "" ) ) {
            this.#basicAuth = Buffer.from( this.username + ":" + this.password ).toString( "base64" );
        }

        return this.#basicAuth;
    }

    get remoteAddr () {
        return null;
    }

    set remoteAddr ( value ) {}

    get country () {
        return null;
    }

    set country ( value ) {}

    get url () {
        var url;

        if ( this.protocol === "http:" ) {
            url = new URL( "http://host" );
        }
        else {
            url = new URL( this.protocol + "//" );
        }

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

    _updated () {
        this.#toString = null;
    }

    // ROTATE
    getProxy () {
        return this;
    }

    getRandomProxy () {
        return this;
    }

    rotateNextProxy () {
        return this;
    }

    rotateRandomProxy () {
        return this;
    }
};
