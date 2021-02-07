const mixins = require( "../../../mixins" );
const Proxy = require( "../../../proxy" );
const ConnectMixin = require( "../../mixins/connect" );
const CountryMixin = require( "../../mixins/country" );
const RemoteAddrMixin = require( "../../mixins/remote-addr" );
const RemoteAddrCacheMixin = require( "../../mixins/remote-addr-cache" );

module.exports = class ProxyHolaStatic extends mixins( ConnectMixin, CountryMixin, RemoteAddrMixin, RemoteAddrCacheMixin, Proxy ) {
    get isHttp () {
        return true;
    }
};
