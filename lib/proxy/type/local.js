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
    _buildProxy ( bucket ) {
        const addr = this.subnet.firstAddr;

        return this.#buildProxy( bucket, addr );
    }

    _buildNextProxy ( bucket, auto ) {
        if ( auto ) {
            bucket.autoAddr = this.#getNextAddr( bucket.autoAddr );

            return this.#buildProxy( bucket, bucket.autoAddr );
        }
        else {
            bucket.manualAddr = this.#getNextAddr( bucket.manualAddr );

            return this.#buildProxy( bucket, bucket.manualAddr );
        }
    }

    // XXX exclude current proxy - bucket.proxy
    _buildRandomProxy ( bucket, auto ) {
        const addr = this.subnet.getRandomAddr();

        return this.#buildProxy( bucket, addr );
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

    #buildProxy ( bucket, addr ) {
        const proxy = super._buildProxy( bucket );

        proxy.hostname = addr.toString();
        proxy.localAddr = addr;

        return proxy;
    }
};
