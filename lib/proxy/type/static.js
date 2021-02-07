const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const ConnectMixin = require( "../mixins/connect" );
const CountryMixin = require( "../mixins/country" );
const RemoteAddrMixin = require( "../mixins/remote-addr" );
const RemoteAddrCacheMixin = require( "../mixins/remote-addr-cache" );

module.exports = class ProxyStatic extends mixins( ConnectMixin, CountryMixin, RemoteAddrMixin, RemoteAddrCacheMixin, Proxy ) {
    #isHttp = false;
    #isSocks = false;

    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super.$init ) super.$init( url, options );

        for ( const protocol of this.protocol.slice( 0, -1 ).split( "+" ) ) {
            if ( protocol === "http" ) this.#isHttp = true;
            else if ( protocol === "socks" || protocol === "socks5" ) this.#isSocks = true;
        }
    }

    get isHttp () {
        return this.#isHttp;
    }

    get isSocks () {
        return this.#isSocks;
    }
};
