import OptionsRange from "../mixins/range.js";
import OptionsRotating from "../mixins/rotating.js";
import OptionsSession from "../mixins/session.js";
import Upstream from "../upstream.js";
import mixins from "#lib/mixins";

export default class ProxyClientLocal extends mixins( OptionsSession, OptionsRange, OptionsRotating, Upstream ) {
    get isHttp () {
        return true;
    }

    get isSocks5 () {
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

    // private
    _buildProxy ( bucket, address ) {
        const proxy = super._buildProxy( bucket );

        proxy.hostname = address.toString();
        proxy.localAddress = address;

        return proxy;
    }

    // protected
    #setNextProxy ( bucket ) {
        var index = bucket.index;

        if ( !index ) {
            index = this.range.firstAddress;
        }
        else {
            index = index.nextAddress;

            if ( !index || !this.range.includes( index ) ) {
                index = this.range.firstAddress;
            }
        }

        bucket.index = index;

        return bucket.setProxy( this._buildProxy( bucket, index ) );
    }

    #setRandomProxy ( bucket ) {
        const index = this.range.getRandomAddress();

        bucket.index = index;

        return bucket.setProxy( this._buildProxy( bucket, index ) );
    }
}

ProxyClientLocal.register( "local:", ProxyClientLocal );
