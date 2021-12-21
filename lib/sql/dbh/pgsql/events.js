import Mutex from "#lib/threads/mutex";
import Signal from "#lib/threads/signal";
import sqlConst from "#lib/sql/const";
import * as uuid from "#lib/uuid";

export default Super =>
    class extends ( Super || Object ) {
        #appLockId;
        #notifications = new Set();
        #pendingSubscribe = new Set();
        #pendingUnsubscribe = new Set();
        #notificationsHandle;
        #waitConnectSignal = new Signal();
        #notificationsMutex = new Mutex();

        constructor () {
            super();

            // watch for notifications subscribe
            this.on( "newListener", this.#subscribe.bind( this ) );
            this.on( "removeListener", this.#unsubscribe.bind( this ) );
        }

        // properties
        get appLockId () {
            return this.#appLockId;
        }

        get isConnected () {
            return !this.#pendingSubscribe.size;
        }

        async waitConnect () {
            if ( this.isConnected ) return;

            return this.#waitConnectSignal.wait();
        }

        // private
        #subscribe ( name ) {

            // reserved event
            if ( sqlConst.reservedEvents.has( name ) ) return;

            // already subscribed
            if ( this.listenerCount( name ) ) return;

            // check, that event name is enumerated in schema
            if ( this.schema.isLoaded && !this.schema.emits.has( name ) ) throw `Event name "${name}" is not emitted by the database`;

            this.#notifications.add( name );
            this.#pendingSubscribe.add( name );
            this.#pendingUnsubscribe.delete( name );

            this.#syncNotifications();
        }

        #unsubscribe ( name ) {

            // reserved event
            if ( sqlConst.reservedEvents.has( name ) ) return;

            // not unsubscribed
            if ( this.listenerCount( name ) ) return;

            this.#notifications.delete( name );
            if ( this.#pendingSubscribe.has( name ) ) {
                this.#pendingSubscribe.delete( name );
            }
            else {
                this.#pendingUnsubscribe.add( name );
            }

            this.#syncNotifications();
        }

        #onNotificationHandleDestroy ( dbh ) {

            // remove handle
            this.#notificationsHandle = null;

            this.#pendingSubscribe = new Set( [...this.#notifications] );
            this.#pendingUnsubscribe.clear();

            this.emit( "disconnect" );

            this.#syncNotifications();
        }

        async #syncNotifications () {
            if ( !this.#notificationsMutex.tryDown() ) return;

            var wasSynched;

            while ( 1 ) {

                // synched
                if ( !this.#pendingSubscribe.size && !this.#pendingUnsubscribe.size ) break;

                wasSynched = true;

                const pendingSubscribe = [...this.#pendingSubscribe],
                    pendingUnsubscribe = [...this.#pendingUnsubscribe];

                const sql = [

                    //
                    ...pendingSubscribe.map( name => `LISTEN "${name}";` ),
                    ...pendingUnsubscribe.map( name => `UNLISTEN "${name}";` ),
                ].join( " " );

                // create handle if not created
                if ( !this.#notificationsHandle ) {
                    this.#notificationsHandle = this._newDbh( { "appName": this.appName + ":" + uuid.v4() } );
                    this.#notificationsHandle.on( "connect", this.#onNotificationHandleDestroy.bind( this ) );
                    this.#notificationsHandle.on( "destroy", this.#onNotificationHandleDestroy.bind( this ) );
                }

                // try to sync
                const res = await this.#notificationsHandle.exec( sql );

                if ( res.ok ) {
                    for ( const name of pendingSubscribe ) this.#pendingSubscribe.delete( name );

                    for ( const name of pendingUnsubscribe ) this.#pendingUnsubscribe.delete( name );
                }
            }

            this.#notificationsMutex.up();
            this.#waitConnectSignal.broadcast();

            if ( wasSynched ) this.emit( "connect" );
        }
    };
