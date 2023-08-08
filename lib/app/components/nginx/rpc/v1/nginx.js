import Mutex from "#core/threads/mutex";
import uuidV4 from "#core/uuid";

export default Super =>
    class extends Super {
        #mutexSet = new Mutex.Set();
        #connectionLockedMutexes = {};

        constructor ( api ) {
            super( api );

            this.api.on( "disconnect", this.#onDisconnect.bind( this ) );
        }

        async API_isLocked ( ctx, mutexId ) {
            if ( !this.#mutexSet.has( mutexId ) ) return result( 200, false );

            return result( 200, this.#mutexSet.get( mutexId ).isLocked );
        }

        async API_tryLock ( ctx, mutexId ) {
            const mutex = this.#mutexSet.get( mutexId );

            // locked
            if ( mutex.tryLock() ) {
                if ( ctx.connection.isConnected ) {
                    return result( 200, this.#onLock( ctx.connection, mutex ) );
                }
                else {
                    mutex.unlock();

                    return result( 200 );
                }
            }

            // not locked
            else {
                return result( 200, false );
            }
        }

        async API_lock ( ctx, mutexId ) {
            const mutex = this.#mutexSet.get( mutexId );

            const signal = ctx.abortSignal;

            await mutex.lock( { signal } );

            if ( signal.aborted ) return result( 500 );

            if ( ctx.connection.isConnected ) {
                return result( 200, this.#onLock( ctx.connection, mutex ) );
            }
            else {
                mutex.unlock();

                return result( 200 );
            }
        }

        async API_unlock ( ctx, mutexId, lockId ) {

            // mutex is not exists
            if ( !this.#mutexSet.has( mutexId ) ) return result( 200, false );

            const mutex = this.#mutexSet.get( mutexId );

            // mutttex is not locked
            if ( !mutex.isLocked ) return result( 200, false );

            // lock id is invalid
            if ( mutex.lockId !== lockId ) return result( 200, false );

            this.#unlock( ctx.connection, mutex );

            return result( 200, true );
        }

        // private
        #onDisconnect ( connection ) {
            const connectionLockedMutexes = this.#connectionLockedMutexes[connection.id];

            if ( connectionLockedMutexes ) {
                for ( const mutex of connectionLockedMutexes.values() ) {
                    this.#unlock( connection, mutex );
                }
            }
        }

        #onLock ( connection, mutex ) {
            mutex.lockId = uuidV4();

            this.#connectionLockedMutexes[connection.id] ??= new Map();
            this.#connectionLockedMutexes[connection.id].set( mutex.id, mutex );

            return mutex.lockId;
        }

        #unlock ( connection, mutex ) {
            mutex.lockId = null;

            if ( this.#connectionLockedMutexes[connection.id] ) {
                this.#connectionLockedMutexes[connection.id].delete( mutex.id );

                if ( !this.#connectionLockedMutexes[connection.id].size ) {
                    delete this.#connectionLockedMutexes[connection.id];
                }
            }

            mutex.unlock();
        }
    };
