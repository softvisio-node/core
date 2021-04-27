require( "#index" );

const mixins = require( "#lib/mixins" );
const Upstream = require( "../upstream" );
const IPAddr = require( "#lib/ip/addr" );

const OptionsSession = require( "../mixins/session" );
const OptionsSubnet = require( "../mixins/subnet" );
const OptionsRotating = require( "../mixins/rotating" );

module.exports = class ProxyLocal extends mixins( OptionsSession, OptionsSubnet, OptionsRotating, Upstream ) {
    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    // public
    async getProxy ( options ) {
        const bucket = this._getBucket( options );

        if ( !bucket.proxy ) {
            if ( bucket.options.session ) {
                this.#setRandomProxy( bucket );
            }
            else {
                this.#setNextProxy( bucket );
            }
        }
        else if ( bucket.requireRotate() ) {
            if ( bucket.options.rotateRandom ) {
                this.#setRandomProxy( bucket );
            }
            else {
                this.#setNextProxy( bucket );
            }
        }

        return bucket.getProxy();
    }

    async getNextProxy ( options ) {
        const bucket = this._getBucket( options );

        this.#setNextProxy( bucket );

        return bucket.getProxy();
    }

    async getRandomProxy ( options ) {
        const bucket = this._getBucket( options );

        this.#setRandomProxy( bucket );

        return bucket.getProxy();
    }

    // protected
    #setNextProxy ( bucket ) {
        var index = bucket.index;

        if ( !index ) {
            index = this.subnet.firstAddr;
        }
        else {
            index = IPAddr.new( index.ipNum.nextIPNumber() );

            if ( !this.subnet.contains( index ) ) {
                index = this.subnet.firstAddr;
            }
        }

        bucket.index = index;

        return bucket.setProxy( this._buildProxy( bucket, index ) );
    }

    #setRandomProxy ( bucket ) {
        const index = this.subnet.getRandomAddr();

        bucket.index = index;

        return bucket.setProxy( this._buildProxy( bucket, index ) );
    }

    _buildProxy ( bucket, addr ) {
        const proxy = super._buildProxy( bucket );

        proxy.hostname = addr.toString();
        proxy.localAddr = addr;

        return proxy;
    }
};
