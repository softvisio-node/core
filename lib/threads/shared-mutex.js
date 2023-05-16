export default class SharedMutex {
    #api;
    #id;
    #clusterId;
    #locked;
    #disconnectListener;
    #abortController = new AbortController();

    constructor ( api, id, { clusterId } = {} ) {
        this.#api = api;
        this.#id = id;

        this.#clusterId = clusterId ? clusterId + "/" + id : id;
    }

    // properties
    get id () {
        return this.#id;
    }

    get signal () {
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
                if ( res.data ) this.#onLock();

                return res.data;
            }
        }
    }

    async lock () {
        while ( 1 ) {
            const res = await this.#api.call( "mutex/lock", this.#clusterId );

            if ( res.ok ) {
                this.#onLock();

                return;
            }
        }
    }

    async unlock () {
        if ( !this.#locked ) return;

        const res = await this.#api.call( "mutex/unlock", this.#clusterId );

        if ( res.ok ) {
            this.#onUnlock();
        }
    }

    // orivate
    #onLock () {
        this.#locked = true;

        this.#disconnectListener = this.#onDisconnect.bind( this );

        this.#api.once( "disconnect", this.#disconnectListener );
    }

    #onUnlock () {
        this.#locked = false;

        if ( this.#disconnectListener ) {
            this.#api.off( "disconnect", this.#disconnectListener );

            this.#disconnectListener = null;
        }
    }

    #onDisconnect () {
        if ( !this.#locked ) return;

        this.#locked = false;

        this.#abortController = new AbortController();

        this.#abortController.avort();
    }
}
