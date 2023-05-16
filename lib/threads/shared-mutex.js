import Set from "#lib/threads/set";

class SharedMutexesSet extends Set {
    #api;
    #clusterId;

    constructor ( api, { clusterId } = {} ) {
        super();

        this.#api = api;
        this.#clusterId = clusterId;
    }

    // properties
    get clusterId () {
        return this.#clusterId;
    }

    // protected
    // XXX
    _createTarget ( id, options ) {
        const target = new SharedMutex( this.#api, id, { "clusterId": this.#clusterId } );

        // target.on( "unlock", this._destroyTarget.bind( this, id ) );

        return target;
    }

    // XXX
    _isTargetDestroyable ( target ) {
        return !target.isLocked && !target.waitingLocks && !target.waitingThreads;
    }
}

export default class SharedMutex {
    #api;
    #id;
    #clusterId;
    #clusterMutexId;
    #lockId;
    #disconnectListener;
    #abortController;

    constructor ( api, id, { clusterId } = {} ) {
        this.#api = api;
        this.#id = id;

        this.#clusterMutexId = clusterId ? clusterId + "/" + id : id;
    }

    // static
    get Set () {
        return SharedMutexesSet;
    }

    // properties
    get id () {
        return this.#id;
    }

    get clusterId () {
        return this.#clusterId;
    }

    get abortSignal () {
        return this.#abortController.signal;
    }

    // public
    async isLocked () {
        if ( this.#lockId ) return true;

        while ( 1 ) {
            const res = await this.#api.call( "mutex/is-locked", this.#clusterMutexId );

            if ( res.ok ) {
                return res.data;
            }
        }
    }

    async tryLock () {
        while ( 1 ) {
            const res = await this.#api.call( "mutex/try-lock", this.#clusterMutexId );

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
            const res = await this.#api.call( "mutex/lock", this.#clusterMutexId );

            if ( res.ok && res.data ) {
                this.#onLock( res.data );

                return;
            }
        }
    }

    async unlock () {

        // not locked
        if ( !this.#lockId ) return true;

        const res = await this.#api.call( "mutex/unlock", this.#clusterMutexId, this.#lockId );

        if ( res.ok ) {

            // unlocked
            if ( res.data ) this.#onUnlock();

            return res.data;
        }

        // connection error, unlocked automatically
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
