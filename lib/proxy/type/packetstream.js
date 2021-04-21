const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsCountry = require( "../mixins/options/country" );
const Upstream = require( "../mixins/upstream" );

const DEFAULT_URL = new URL( "http://proxy.packetstream.io:31112" );

module.exports = class ProxyStatic extends mixins( OptionsCountry, Upstream, Proxy ) {
    get isHttp () {
        return true;
    }

    async _buildProxy ( options = {} ) {
        return Proxy.new( DEFAULT_URL, {
            "username": this.username,
            "password": this.password + ( this.country ? "_country-" + this.country : "" ),
        } );
    }
};
