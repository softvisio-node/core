const mixins = require( "../../mixins" );
const Static = require( "../static" );

const OptionsCountry = require( "../mixins/options/country" );
const OptionsRemoteAddr = require( "../mixins/options/remote-addr" );
const OptionsLocalAddr = require( "../mixins/options/local-addr" );

module.exports = class ProxyStatic extends mixins( OptionsCountry, OptionsRemoteAddr, OptionsLocalAddr, Static ) {
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
