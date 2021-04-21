require( "@softvisio/core" );

const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsSession = require( "../mixins/options/session" );
const OptionsSubnet = require( "../mixins/options/subnet" );
const Pool = require( "../mixins/pool" );
const Rotating = require( "../mixins/rotating" );
const Upstream = require( "../mixins/upstream" );
const IPAddr = require( "#lib/ip/addr" );

module.exports = class ProxyLocal extends mixins( OptionsSession, OptionsSubnet, Pool, Rotating, Upstream, Proxy ) {
    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    _buildProxy ( options = {} ) {
        const addr = this.subnet.firstAddr;

        return this.#buildProxy( addr );
    }

    _rotateNextProxy ( cache ) {
        if ( !cache.addr ) {
            cache.addr = this.subnet.firstAddr;
        }
        else {
            const addr = IPAddr.new( cache.addr.ipNum.nextIPNumber() );

            if ( this.subnet.contains( addr ) ) {
                cache.addr = addr;
            }
            else {
                cache.addr = this.subnet.firstAddr;
            }
        }

        return this.#buildProxy( cache.addr );
    }

    // XXX exclude current proxy - cache.proxy
    _rotateRandomProxy ( cache ) {
        const addr = this.subnet.getRandomAddr();

        return this.#buildProxy( addr );
    }

    #buildProxy ( addr ) {
        const proxy = super._buildProxy();

        proxy.hostname = addr.toString();

        proxy.localAddr = addr;

        return proxy;
    }
};
