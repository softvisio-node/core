import Signal from "#lib/threads/signal";
import sqlConst from "#lib/sql/const";
import * as uuid from "#lib/uuid";

export default Super =>
    class extends ( Super || Object ) {
        #appLockId;
        #connection;
        #isConnected = false;
        #listen = new Set();
        #unlisten = new Set();
        #waitConnectSignal = new Signal();

        constructor () {
            super();

            // watch for notifications subscribe
            this.on( "newListener", this.#on.bind( this ) );
            this.on( "removeListener", this.#off.bind( this ) );
        }

        // properties
        get appLockId () {
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
            this.#sync();
        }

        #onDestroy () {
            this.#connection = null;
            this.#isConnected = false;
            this.#appLockId = null;
            this.#unlisten.clear();

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
            this.#unlisten.delete( name );

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
            this.#unlisten.add( name );

            this.#sync();
        }

        async #sync () {

            // not connected
            if ( !this.#connection ) {
                this._connect();

                return;
            }

            const sql = [];

            if ( this.#unlisten.size ) {
                this.#unlisten.forEach( name => sql.push( `UNLISTEN "${name}";` ) );

                this.#unlisten.clear();
            }

            if ( this.#listen.size ) {
                this.#listen.forEach( name => sql.push( `LISTEN "${name}";` ) );
            }

            // sync
            if ( sql.length ) {
                const connection = this.#connection;

                const res = await connection.do( sql.join( " " ) );

                if ( !res.ok ) {
                    connection.destroy();

                    return;
                }
            }

            if ( !this.#isConnected ) {
                this.#isConnected = true;

                this.emit( "connect" );

                this.#waitConnectSignal.broadcast();
            }
        }
    };
