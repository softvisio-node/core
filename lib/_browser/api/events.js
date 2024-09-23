import Events from "#lib/events";

const localEvents = new Set( [ "connect", "disconnect", "sessionDisable", "sessionDelete", "sessionReload", "accessDenied", "call" ] );

const SYNC_DELAY = 1;

export default class {
    #events;
    #listen = new Set();
    #pendingSubscribe = new Set();
    #pendingUnsubscribe = new Set();
    #connection;
    #syncStarted;

    constructor () {
        this.#events = new Events( { "maxListeners": Infinity } ).watch( this.#watcher.bind( this ) );
    }

    // properties
    get _eventsConnection () {
        return this.#connection;
    }

    set _eventsConnection ( value ) {
        this.#connection = value;

        if ( !value ) return;

        this.#pendingSubscribe = new Set( [ ...this.#listen ] );
        this.#pendingUnsubscribe.clear();

        this.#sync();
    }

    // public
    on ( name, listener ) {
        if ( !this.isPersistent ) return this;

        this.#events.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        if ( !this.isPersistent ) return this;

        this.#events.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        if ( !this.isPersistent ) return this;

        this.#events.off( name, listener );

        return this;
    }

    // protected
    _emit ( name, args ) {
        this.#events.emit( name, ...( args || [] ) );
    }

    _emitRemote ( name, args ) {

        // local event
        if ( localEvents.has( name ) ) return;

        this._emit( name, args );
    }

    // private
    #watcher ( name, subscribe ) {

        // local event
        if ( localEvents.has( name ) ) return;

        if ( subscribe ) {
            this.#listen.add( name );
            this.#pendingSubscribe.add( name );
            this.#pendingUnsubscribe.delete( name );
        }
        else {
            this.#listen.delete( name );
            this.#pendingSubscribe.delete( name );
            this.#pendingUnsubscribe.add( name );
        }

        this.#sync();
    }

    async #sync ( newConnection ) {
        if ( this.#syncStarted ) return;

        // nothing to sync
        if ( !this.#pendingSubscribe.size && !this.#pendingUnsubscribe.size ) return;

        // start sync
        this.#syncStarted = true;
        await new Promise( resolve => setTimeout( resolve, SYNC_DELAY ) );
        this.#syncStarted = false;

        if ( !this.#connection ) return;

        // subscribe
        if ( this.#pendingSubscribe.size ) {
            this.#connection.voidCall( "/subscribe", [ ...this.#pendingSubscribe ] );

            this.#pendingSubscribe.clear();
        }

        // unsubscribe
        if ( this.#pendingUnsubscribe.size ) {
            this.#connection.voidCall( "/unsubscribe", [ ...this.#pendingUnsubscribe ] );

            this.#pendingUnsubscribe.clear();
        }
    }
}
