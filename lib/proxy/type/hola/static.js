const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const ConnectMixin = require( "../mixins/connect" );
const CountryMixin = require( "../mixins/country" );
const IPAddr = require( "../../../ip/addr" );

module.exports = class ProxyHolaStatic extends mixins( ConnectMixin, CountryMixin, Proxy ) {
    #remoteAddr;

    get isHttp () {
        return true;
    }

    async getRemoteAddr () {
        if ( !this.#remoteAddr ) this.#remoteAddr = new IPAddr( this.hostname );

        return this.#remoteAddr;
    }
};
