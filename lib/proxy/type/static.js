const { mix } = require( "../../mixins" );
const Proxy = require( "../proxy" );
const ConnectMixin = require( "../mixins/connect" );
const RemoteAddrMixin = require( "../mixins/remote-addr" );

module.exports = class ProxyStatic extends mix( ConnectMixin, RemoteAddrMixin, Proxy ) {
    #isHttp = false;
    #isSocks = false;

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
};
