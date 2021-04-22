const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsCountry = require( "../mixins/options/country" );
const OptionsRemoteAddr = require( "../mixins/options/remote-addr" );
const OptionsLocalAddr = require( "../mixins/options/local-addr" );
const Static = require( "../mixins/static" );

module.exports = class ProxyStatic extends mixins( OptionsCountry, OptionsRemoteAddr, OptionsLocalAddr, Static, Proxy ) {
    #isHttp = false;
    #isSocks = false;

    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super.$init ) super.$init( url, options );

        if ( this.protocol.includes( "http" ) ) this.#isHttp = true;

        if ( this.protocol.includes( "socks" ) ) this.#isSocks = true;
    }

    get isHttp () {
        return this.#isHttp;
    }

    get isSocks () {
        return this.#isSocks;
    }

    getPlaywrightProxy () {

        // http
        if ( this.isHttp ) {
            return {
                "server": "http://" + this.hostname + ":" + this.port,
                "username": this.username,
                "password": this.password,
            };
        }

        // socks
        else {
            return {
                "server": "socks5://" + this.hostname + ":" + this.port,
            };
        }
    }
};
