const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const ConnectMixin = require( "../mixins/connect" );
const RemoteAddrMixin = require( "../mixins/remote-addr" );
const IpMixin = require( "../mixins/ip" );
const CountryMixin = require( "../mixins/country" );

module.exports = class ProxyStatic extends mixins( ConnectMixin, RemoteAddrMixin, IpMixin, CountryMixin, Proxy ) {
    #isHttp = false;
    #isSocks = false;
    #remoteAddr;

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        super( url, options );

        for ( const type of this.type.split( "+" ) ) {
            if ( type === "http" ) this.#isHttp = true;
            else if ( type === "socks" || type === "socks5" ) this.#isSocks = true;
        }
    }

    get isHttp () {
        return this.#isHttp;
    }

    get isSocks () {
        return this.#isSocks;
    }

    async getRemoteAddr () {
        if ( !this.#remoteAddr ) this.#remoteAddr = await super.getRemoteAddr();

        return this.#remoteAddr;
    }
};
