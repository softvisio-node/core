import Signal from "#lib/threads/signal";
import constants from "#lib/sql/constants";
import { sql } from "#lib/sql/query";

const publishQuery = sql`SELECT pg_notify( ?, ?::text )`.prepare();

export default Super =>
    class extends ( Super || Object ) {
        #pid;
        #connection;
        #isConnected = false;
        #listen = new Set();
        #pendingSubscribe = new Set();
        #pendingUnsubscribe = new Set();
        #waitConnectSignal = new Signal();
        #abortController;

        constructor () {
            super();

            // watch for notifications subscribe
            this.on( "newListener", this.#subscribe.bind( this ) );
            this.on( "removeListener", this.#unsubscribe.bind( this ) );
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

        publish ( name, data ) {
            if ( !this.#isConnected ) return;

            this.#connection.select( publishQuery, [name, data] );
        }

        // protected
        _connect () {
            if ( this.#connection ) return;

            this.#connection = this._newConnection();
            this.#connection.once( "connect", this.#onConnect.bind( this ) );
            this.#connection.once( "destroy", this.#onDestroy.bind( this ) );
        }

        // private
        #onConnect ( connection ) {
            this.#isConnected = true;
            this.#pid = connection.pid;
            this.#abortController = new AbortController();
            this.#abortController.signal.pid = this.#pid;

            this.#pendingSubscribe = new Set( [...this.#listen] );
            this.#pendingUnsubscribe.clear();

            this.#sync();

            this.#waitConnectSignal.broadcast();

            this.emit( "connect" );
        }

        #onDestroy () {
            const wasConnected = this.#isConnected;

            this.#connection = null;
            this.#isConnected = false;
            this.#pid = null;

            if ( this.#abortController ) this.#abortController.abort();

            this._connect();

            if ( wasConnected ) this.emit( "disconnect" );
        }

        #subscribe ( name ) {

            // reserved event
            if ( constants.reservedEvents.has( name ) ) return;

            // already added
            if ( this.#listen.has( name ) ) return;

            // check, that event name is enumerated in schema
            if ( this.schema.isLoaded && !this.schema.emits.has( name ) ) throw `Event name "${name}" is not emitted by the database`;

            this.#listen.add( name );
            this.#pendingSubscribe.add( name );
            this.#pendingUnsubscribe.delete( name );

            this.#sync();
        }

        #unsubscribe ( name ) {

            // reserved event
            if ( constants.reservedEvents.has( name ) ) return;

            // has other listeners
            if ( this.listenerCount( name ) ) return;

            // already unlisten
            if ( !this.#listen.has( name ) ) return;

            this.#listen.delete( name );
            this.#pendingSubscribe.delete( name );
            this.#pendingUnsubscribe.add( name );

            this.#sync();
        }

        async #sync () {
            if ( !this.#isConnected ) return;

            const sql = [];

            if ( this.#pendingSubscribe.size ) {
                this.#pendingSubscribe.forEach( name => sql.push( `LISTEN "${name}";` ) );

                this.#pendingSubscribe.clear();
            }

            if ( this.#pendingUnsubscribe.size ) {
                this.#pendingUnsubscribe.forEach( name => sql.push( `UNLISTEN "${name}";` ) );

                this.#pendingUnsubscribe.clear();
            }

            // nothing to sync
            if ( !sql.length ) return;

            const res = await this.#connection.do( sql.join( " " ) );

            if ( !res.ok ) this.#connection.destroy();
        }
    };
