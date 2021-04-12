const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsCountry = require( "../mixins/options/country" );
const OptionsRemoteAddr = require( "../mixins/options/remote-addr" );
const Static = require( "../mixins/static" );

module.exports = class ProxyStatic extends mixins( OptionsCountry, OptionsRemoteAddr, Static, Proxy ) {
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
};
