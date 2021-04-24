require( "#index" );

const mixins = require( "#lib/mixins" );
const Pool = require( "../pool" );
const IPAddr = require( "#lib/ip/addr" );

const OptionsSession = require( "../mixins/session" );
const OptionsSubnet = require( "../mixins/subnet" );

module.exports = class ProxyLocal extends mixins( OptionsSession, OptionsSubnet, Pool ) {
    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    _buildProxy ( options = {} ) {
        var addr;

        if ( options.session ) addr = this.subnet.getRandomAddr();
        else return ( addr = this.subnet.firstAddr );

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
