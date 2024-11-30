import { LongTimeout } from "#lib/timers";

export default class CacheLruEntry {
    #cache;
    #key;
    #value;
    #expires;
    #timeout;

    constructor ( cache, key, value, maxAge ) {
        this.#cache = cache;
        this.#key = key;
        this.#value = value;

        if ( maxAge ) {
            this.#expires = Date.now() + maxAge;

            if ( this.#cache.autoDeleteExpiredEntries ) {
                this.#timeout = new LongTimeout( maxAge, this.#onExpire.bind( this ) ).unref();
            }
        }
        else {
            this.#expires = false;
        }
    }

    // properties
    get key () {
        return this.#key;
    }

    get value () {
        return this.#value;
    }

    get isExpired () {
        return this.#expires && this.#expires < Date.now();
    }

    // public
    delete () {
        if ( this.#timeout ) {
            this.#timeout.clear();

            this.#timeout = null;
        }
    }

    // private
    #onExpire () {
        this.#cache.delete( this.#key );
    }
}
