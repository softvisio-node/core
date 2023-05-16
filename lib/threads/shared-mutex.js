// XXX implement set

export default class SharedMutex {
    #api;
    #id;
    #clusterId;
    #lockId;
    #disconnectListener;
    #abortController;

    constructor ( api, id, { clusterId } = {} ) {
        this.#api = api;
        this.#id = id;

        this.#clusterId = clusterId ? clusterId + "/" + id : id;
    }

    // properties
    get id () {
        return this.#id;
    }

    get abortSignal () {
        return this.#abortController.signal;
    }

    // public
    async isLocked () {
        while ( 1 ) {
            const res = await this.#api.call( "mutex/is-locked", this.#clusterId );

            if ( res.ok ) {
                return res.data;
            }
        }
    }

    async tryLock () {
        while ( 1 ) {
            const res = await this.#api.call( "mutex/try-lock", this.#clusterId );

            if ( res.ok ) {

                // locked
                if ( res.data ) {
                    this.#onLock( res.data );

                    return true;
                }

                // not locked
                else {
                    return false;
                }
            }
        }
    }

    async lock () {
        while ( 1 ) {
            const res = await this.#api.call( "mutex/lock", this.#clusterId );

            if ( res.ok && res.data ) {
                this.#onLock( res.data );

                return;
            }
        }
    }

    // XXX
    async unlock () {
        if ( !this.#lockId ) return true;

        const res = await this.#api.call( "mutex/unlock", this.#clusterId, this.#lockId );

        if ( res.ok ) {
            if ( res.data ) this.#onUnlock();

            return res.data;
        }
        else {
            return true;
        }
    }

    // orivate
    #onLock ( lockId ) {
        this.#lockId = lockId;

        this.#abortController = new AbortController();

        // subscribe
        this.#disconnectListener = this.#onUnlock.bind( this );

        this.#api.once( "disconnect", this.#disconnectListener );
    }

    #onUnlock () {
        if ( !this.#lockId ) return;

        this.#lockId = null;

        this.#abortController.abort();
        this.#abortController = new AbortController();

        // unsubscribe
        if ( this.#disconnectListener ) {
            this.#api.off( "disconnect", this.#disconnectListener );

            this.#disconnectListener = null;
        }
    }
}
