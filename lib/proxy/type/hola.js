const Proxy = require( "../proxy" );
const fetch = require( "../../http/fetch" );
const IPAddr = require( "../../ip-addr" );
const { "v4": uuidv4 } = require( "uuid" );

const BASE_URL = "https://client.hola.org/client_cgi";
const EXT_VER = "1.176.815";
const CLIENT_ID = uuidv4().replace( /-/g, "" );
var KEY;

var LAST_UPDATED;
const UPDATE_TIMEOUT = 1000 * 60 * 10; // 10 minutes

var PROXIES;
var COUNTRIES;
var PROXY_IP;

// supported options: controlHost, controlPort, controlPassword
class ProxyTypeHola extends Proxy {
    #currentIp;

    constructor ( url, options = {} ) {
        super( url, options );
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

    // STATIC
    get isStatic () {
        return false;
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

        // refresh list
        if ( !LAST_UPDATED || new Date() - LAST_UPDATED > UPDATE_TIMEOUT ) {
            await this._getProxies();

            if ( !PROXIES ) return false;
        }

        const country = this.country || COUNTRIES[Math.floor( Math.random( COUNTRIES.length ) )];

        const proxies = PROXIES[country];

        if ( !proxies ) return false;

        const proxy = proxies[Math.floor( Math.random( proxies.length ) )];

        const url = new URL( proxy );

        this.host = url.hostname;
        this.port = url.port;
        this.username = url.username;
        this.password = url.password;

        this._clearEffectiveHost();
        this._clearEffectivePort();
        this._clearEffectiveUsername();
        this._clearEffectivePassword();

        this.#currentIp = PROXY_IP[proxy];

        return true;
    }

    async _getProxies () {
        var url = BASE_URL + "/background_init?uuid=" + CLIENT_ID;

        const params = new URLSearchParams( {
            "login": "1",
            "ver": EXT_VER,
        } );

        var res = await fetch( url, {
            "method": "post",
            "headers": {
                "User-Agent": "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
            },
            "body": params,
        } );

        var data = await res.json();

        KEY = data.key;

        url =
            BASE_URL +
            "/zgettunnels?" +
            new URLSearchParams( {
                "country": "US", // if country is not set it returns small list
                "limit": 9999999,
                "ping_id": Math.random(),
                "ext_ver": EXT_VER,
                "browser": "chrome",
                "product": "cws",
                "uuid": CLIENT_ID,
                "session_key": KEY,
                "is_premium": 1,
            } );

        res = await fetch( url, {
            "headers": {
                "User-Agent": "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
            },
        } );

        data = await res.json();

        PROXIES = {};
        PROXY_IP = {};

        Object.keys( data.ip_list ).forEach( host => {
            const url = "http://" + "user-uuid-" + CLIENT_ID + ":" + data.agent_key + "@" + host + ":" + 22222;

            const ip = new IPAddr( data.ip_list[host] );

            const country = ip.geo.country.iso_code;

            if ( !PROXIES[country] ) PROXIES[country] = [];

            PROXIES[country].push( url );

            PROXY_IP[url] = ip;
        } );

        COUNTRIES = Object.keys( PROXIES );

        LAST_UPDATED = new Date();
    }
}

module.exports = ProxyTypeHola;
