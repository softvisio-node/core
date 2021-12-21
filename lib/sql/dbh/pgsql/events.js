import Signal from "#lib/threads/signal";
import sqlConst from "#lib/sql/const";
import * as uuid from "#lib/uuid";
import Mutex from "#lib/threads/mutex";

export default Super =>
    class extends ( Super || Object ) {
        #appLockId;
        #connection;
        #isConnected = false;
        #listen = new Set();
        #pendingListen = new Set();
        #pendingUnlisten = new Set();
        #waitConnectSignal = new Signal();
        #mutex = new Mutex();

        constructor () {
            super();

            // watch for notifications subscribe
            this.on( "newListener", this.#on.bind( this ) );
            this.on( "removeListener", this.#off.bind( this ) );
        }

        // properties
        get appLockId () {
            if ( !this.#isConnected ) return null;

            return this.#appLockId;
        }

        get isConnected () {
            return this.#isConnected;
        }

        async waitConnect () {
            if ( this.#isConnected ) return;

            return this.#waitConnectSignal.wait();
        }

        // protected
        _connect () {
            if ( this.#connection ) return;

            this.#appLockId = this.appName + ":" + uuid.v4();

            this.#connection = this._newDbh( { "appName": this.#appLockId } );
            this.#connection.on( "connect", this.#onConnect.bind( this ) );
            this.#connection.on( "destroy", this.#onDestroy.bind( this ) );
        }

        // private
        #onConnect () {
            this.#sync( true );
        }

        #onDestroy () {
            this.#connection = null;
            this.#isConnected = false;
            this.#appLockId = null;
            this.#pendingListen.clear();
            this.#pendingUnlisten.clear();

            this._connect();

            this.emit( "disconnect" );
        }

        #on ( name ) {

            // reserved event
            if ( sqlConst.reservedEvents.has( name ) ) return;

            // already added
            if ( this.#listen.has( name ) ) return;

            // check, that event name is enumerated in schema
            if ( this.schema.isLoaded && !this.schema.emits.has( name ) ) throw `Event name "${name}" is not emitted by the database`;

            this.#listen.add( name );

            if ( this.#pendingUnlisten.has( name ) ) {
                this.#pendingUnlisten.delete( name );
            }
            else {
                this.#pendingListen.add( name );
            }

            this.#sync();
        }

        #off ( name ) {

            // reserved event
            if ( sqlConst.reservedEvents.has( name ) ) return;

            // has other listeners
            if ( this.listenerCount( name ) ) return;

            // already unlisten
            if ( !this.#listen.has( name ) ) return;

            this.#listen.delete( name );

            if ( this.#pendingListen.has( name ) ) {
                this.#pendingListen.delete( name );
            }
            else {
                this.#pendingUnlisten.add( name );
            }

            this.#sync();
        }

        async #sync ( connect ) {
            if ( !this.#connection ) return this._connect();

            if ( !this.#mutex.tryDown() ) return;

            while ( 1 ) {
                if ( !this.#connection ) break;

                if ( !connect && !this.#isConnected ) break;

                const sql = [];

                // connect, sync full listeners list
                if ( connect ) {
                    if ( this.#listen.size ) {
                        this.#listen.forEach( name => sql.push( `LISTEN "${name}";` ) );
                    }
                }

                // sync pending events
                else {
                    if ( this.#pendingUnlisten.size ) {
                        this.#pendingUnlisten.forEach( name => sql.push( `UNLISTEN "${name}";` ) );
                    }

                    if ( this.#pendingListen.size ) {
                        this.#pendingListen.forEach( name => sql.push( `LISTEN "${name}";` ) );
                    }
                }

                // clear pending events lists
                this.#pendingListen.clear();
                this.#pendingUnlisten.clear();

                console.log( sql );

                // sync
                if ( sql.length ) {
                    const connection = this.#connection;

                    const res = await connection.do( sql.join( " " ) );

                    if ( !res.ok ) {
                        connection.destroy();

                        break;
                    }
                }

                if ( !this.#isConnected ) {
                    this.#isConnected = true;

                    this.emit( "connect" );

                    this.#waitConnectSignal.broadcast();
                }

                // exit, if has no pending events
                if ( !this.#pendingListen.size && !this.#pendingUnlisten.size ) break;
            }

            this.#mutex.up();
        }
    };
