const Proxy = require( "../proxy" );
const fetch = require( "../../http/fetch" );
const IPAddr = require( "../../ip/addr" );
const { "v4": uuidv4 } = require( "uuid" );

var HOLA;

class Hola {
    #BASE_URL = "https://client.hola.org/client_cgi";
    #EXT_VER = "1.176.815";
    #CLIENT_ID = uuidv4().replace( /-/g, "" );

    #updateTimeout = 1000 * 60 * 10; // 10 minutes
    #updateCallbacks = [];
    #lastUpdated;
    #isUpdating;

    #key;

    proxies = [];
    countries = {};

    async #update () {

        // update is not required
        if ( !( this.#isUpdating || !this.#lastUpdated || new Date() - this.#lastUpdated > this.#updateTimeout ) ) return;

        return new Promise( resolve => {
            this.#updateCallbacks.push( resolve );

            this.#_update();
        } );
    }

    async #_update () {
        if ( this.#isUpdating ) return;

        console.log( `Updating hola proxies list` );

        this.#isUpdating = true;

        var data;

        try {
            var res = await fetch( this.#BASE_URL + "/background_init?uuid=" + this.#CLIENT_ID, {
                "method": "post",
                "headers": {
                    "User-Agent": "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
                },
                "body": new URLSearchParams( {
                    "login": "1",
                    "ver": this.#EXT_VER,
                } ),
            } );

            data = await res.json();

            this.#key = data.key;

            const url =
                this.#BASE_URL +
                "/zgettunnels?" +
                new URLSearchParams( {
                    "country": "US", // if country is not set it returns small list of proxies
                    "limit": 9999999,
                    "ping_id": Math.random(),
                    "ext_ver": this.#EXT_VER,
                    "browser": "chrome",
                    "product": "cws",
                    "uuid": this.#CLIENT_ID,
                    "session_key": this.#key,
                    "is_premium": 1,
                } );

            res = await fetch( url, {
                "headers": {
                    "User-Agent": "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
                },
            } );

            data = await res.json();

            this.#lastUpdated = new Date();

            this.proxies = [];
            this.countries = {};

            Object.keys( data.ip_list ).forEach( host => {
                const proxy = {
                    "url": "http://" + "user-uuid-" + this.#CLIENT_ID + ":" + data.agent_key + "@" + host + ":" + 22222,
                    "hostname": host,
                    "port": 22222,
                    "username": "user-uuid-" + this.#CLIENT_ID,
                    "password": data.agent_key,
                    "ip": new IPAddr( data.ip_list[host] ),
                    "country": "",
                };

                proxy.country = proxy.ip.geo.country.iso_code;

                this.proxies.push( proxy );

                if ( !this.countries[proxy.country] ) this.countries[proxy.country] = [];

                this.countries[proxy.country].push( proxy );
            } );
        }
        catch ( e ) {
            console.log( `Hola update error: ${e}` );
        }

        this.#isUpdating = false;

        const callbacks = this.#updateCallbacks;

        this.#updateCallbacks = [];

        for ( const cb of callbacks ) cb();
    }

    async getRandomProxy ( country ) {

        // update proxies list if required
        await this.#update();

        // proxies list is empty
        if ( !this.proxies.length ) return;

        var proxy;

        if ( country ) {
            if ( !this.countries[country] ) return;

            proxy = this.countries[country][Math.floor( Math.random() * this.countries[country].length )];
        }
        else {
            proxy = this.proxies[Math.floor( Math.random() * this.proxies.length )];
        }

        return proxy;
    }
}

class ProxyTypeHola extends Proxy {
    #currentIp;

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        super( url, options );

        url.searchParams.forEach( ( value, name ) => {
            if ( !( name in options ) ) options[name] = value;
        } );

        if ( options.country ) this.country = options.country.toUpperCase();
    }

    // TYPE
    get isHola () {
        return true;
    }

    get type () {
        return "hola";
    }

    get isHttp () {
        return true;
    }

    get hola () {
        if ( !HOLA ) HOLA = new Hola();

        return HOLA;
    }

    // STATIC
    get isStatic () {
        return super.isStatic;
    }

    set isStatic ( isStatic ) {}

    // COUNTRY
    get country () {
        return super.country;
    }

    set country ( country ) {
        this._setCountry( country );
    }

    // SESSION
    async startSession () {
        if ( !( await this._setRandomProxy() ) ) return false;

        super.isStatic = true;

        return true;
    }

    endSession () {
        super.isStatic = false;
    }

    async getRemoteAddr () {
        if ( !this.#currentIp ) await this._setRandomProxy();

        return this.#currentIp;
    }

    // PROTECTED
    async _beforeConnect ( url, type ) {

        // rotate
        if ( !this.isStatic ) return await this._setRandomProxy();

        return true;
    }

    async _setRandomProxy () {
        const proxy = await this.hola.getRandomProxy( this.country );

        // unable to get proxy
        if ( !proxy ) return false;

        this.#currentIp = proxy.ip;

        this.host = proxy.hostname;
        this.port = proxy.port;
        this.username = proxy.username;
        this.password = proxy.password;

        this._clearEffectiveHost();
        this._clearEffectivePort();
        this._clearEffectiveUsername();
        this._clearEffectivePassword();

        return true;
    }
}

module.exports = ProxyTypeHola;
