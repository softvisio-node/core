const mixins = require( "../../../mixins" );
const Proxy = require( "../../../proxy" );
const ConnectMixin = require( "../../mixins/connect" );
const CountryMixin = require( "../../mixins/country" );
const RemoteAddrMixinCache = require( "../../mixins/remote-addr-cache" );

module.exports = class ProxyHolaStatic extends mixins( ConnectMixin, CountryMixin, RemoteAddrMixinCache, Proxy ) {
    get isHttp () {
        return true;
    }
};
