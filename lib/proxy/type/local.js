import mixins from "#lib/mixins";
import Upstream from "../upstream.js";

import OptionsSession from "../mixins/session.js";
import OptionsRange from "../mixins/range.js";
import OptionsRotating from "../mixins/rotating.js";

export default class ProxyClientLocal extends mixins( OptionsSession, OptionsRange, OptionsRotating, Upstream ) {
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
            index = this.range.firstAddr;
        }
        else {
            index = index.getNextAddr();

            if ( !index || !this.range.contains( index ) ) {
                index = this.range.firstAddr;
            }
        }

        bucket.index = index;

        return bucket.setProxy( this._buildProxy( bucket, index ) );
    }

    #setRandomProxy ( bucket ) {
        const index = this.range.getRandomAddr();

        bucket.index = index;

        return bucket.setProxy( this._buildProxy( bucket, index ) );
    }

    _buildProxy ( bucket, addr ) {
        const proxy = super._buildProxy( bucket );

        proxy.hostname = addr.toString();
        proxy.localAddr = addr;

        return proxy;
    }
}

ProxyClientLocal.register( "local:", ProxyClientLocal );
