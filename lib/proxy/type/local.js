require( "#index" );

const mixins = require( "#lib/mixins" );
const Rotating = require( "../rotating" );
const IPAddr = require( "#lib/ip/addr" );

const OptionsSession = require( "../mixins/session" );
const OptionsSubnet = require( "../mixins/subnet" );

module.exports = class ProxyLocal extends mixins( OptionsSession, OptionsSubnet, Rotating ) {
    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    get defaultRotate () {
        return true;
    }

    // protected
    _buildProxy ( cache ) {
        const addr = this.subnet.firstAddr;

        return this.#buildProxy( cache, addr );
    }

    _buildNextProxy ( cache, auto ) {
        if ( auto ) {
            cache.autoAddr = this.#getNextAddr( cache.autoAddr );

            return this.#buildProxy( cache, cache.autoAddr );
        }
        else {
            cache.manualAddr = this.#getNextAddr( cache.manualAddr );

            return this.#buildProxy( cache, cache.manualAddr );
        }
    }

    // XXX exclude current proxy - cache.proxy
    _buildRandomProxy ( cache, auto ) {
        const addr = this.subnet.getRandomAddr();

        return this.#buildProxy( cache, addr );
    }

    // private
    #getNextAddr ( addr ) {
        if ( !addr ) return this.subnet.firstAddr;

        const nextAddr = IPAddr.new( addr.ipNum.nextIPNumber() );

        if ( this.subnet.contains( nextAddr ) ) {
            return nextAddr;
        }
        else {
            return this.subnet.firstAddr;
        }
    }

    #buildProxy ( cache, addr ) {
        const proxy = super._buildProxy( cache );

        proxy.hostname = addr.toString();
        proxy.localAddr = addr;

        return proxy;
    }
};
