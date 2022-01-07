import Signal from "#lib/threads/signal";
import sqlConst from "#lib/sql/const";
import Mutex from "#lib/threads/mutex";

export default Super =>
    class extends ( Super || Object ) {
        #pid;
        #connection;
        #isConnected = false;
        #listen = new Set();
        #pendingListen = new Set();
        #pendingUnlisten = new Set();
        #waitConnectSignal = new Signal();
        #mutex = new Mutex();
        #abortController;

        constructor () {
            super();

            // watch for notifications subscribe
            this.on( "newListener", this.#on.bind( this ) );
            this.on( "removeListener", this.#off.bind( this ) );
        }

        // properties
        get pid () {
            return this.#pid;
        }

        get isConnected () {
            return this.#isConnected;
        }

        // public
        async waitConnect () {
            if ( this.#isConnected ) return;

            return this.#waitConnectSignal.wait();
        }

        async getAbortSignal () {
            await this.waitConnect();

            return this.#abortController.signal;
        }

        // protected
        _connect () {
            if ( this.#connection ) return;

            this.#connection = this._newConnection();
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
            this.#pid = null;
            this.#pendingListen.clear();
            this.#pendingUnlisten.clear();

            if ( this.#abortController ) this.#abortController.abort();

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

                const connection = this.#connection;

                // sync
                if ( sql.length ) {
                    const res = await connection.do( sql.join( " " ) );

                    if ( !res.ok ) {
                        connection.destroy();

                        break;
                    }
                }

                if ( connect ) {
                    connect = false;
                    this.#isConnected = true;

                    this.#pid = connection.pid;

                    this.#abortController = new AbortController();
                    this.#abortController.signal.pid = this.#pid;

                    this.emit( "connect" );

                    this.#waitConnectSignal.broadcast();
                }

                // exit, if has no pending events
                if ( !this.#pendingListen.size && !this.#pendingUnlisten.size ) break;
            }

            this.#mutex.up();
        }
    };
