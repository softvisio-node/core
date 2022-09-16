const localEvents = new Set( ["connect", "disconnect", "signout", "authorizationRequired"] );

const SYNC_DELAY = 1;

export default class {
    #listeners = {};
    #listen = new Set();
    #pendingSubscribe = new Set();
    #pendingUnsubscribe = new Set();
    #connection;
    #syncStarted;

    // properties
    get _eventsConnection () {
        return this.#connection;
    }

    set _eventsConnection ( value ) {
        this.#connection = value;

        if ( !value ) return;

        this.#pendingSubscribe = new Set( [...this.#listen] );
        this.#pendingUnsubscribe.clear();

        this.#sync();
    }

    // public
    on ( name, listener ) {
        this.#subscribe( name, listener, false );

        return this;
    }

    off ( name, listener ) {
        if ( this.#unsubscribe( name, listener ) ) this.#sync();

        return this;
    }

    once ( name, listener ) {
        this.#subscribe( name, listener, true );

        return this;
    }

    // protected
    _emit ( name, args ) {
        const listeners = this.#listeners[name];

        if ( !listeners ) return;

        var sync;

        for ( const [listener, once] of listeners.entries() ) {
            listener( ...( args || [] ) );

            if ( once && this.#unsubscribe( name, listener ) ) sync = true;
        }

        if ( sync ) this.#sync();
    }

    _emitRemote ( name, args ) {

        // local event
        if ( localEvents.has( name ) ) return;

        this._emit( name, args );
    }

    // private
    #subscribe ( name, listener, once ) {
        if ( !this.persistent ) return;

        const listeners = ( this.#listeners[name] ||= new Map() );

        listeners.set( listener, once );

        // local event
        if ( localEvents.has( name ) ) return;

        // already subscribed
        if ( this.#listen.has( name ) ) return;

        this.#listen.add( name );
        this.#pendingSubscribe.add( name );
        this.#pendingUnsubscribe.delete( name );

        this.#sync();
    }

    #unsubscribe ( name, listener ) {
        if ( !this.persistent ) return;

        const listeners = this.#listeners[name];

        if ( !listeners || !listeners.has( listener ) ) return;
        listeners.delete( listener );
        if ( !listeners.size ) delete this.#listeners[name];

        // local event
        if ( localEvents.has( name ) ) return;

        // not subscribed
        if ( !this.#listen.has( name ) ) return;

        this.#listen.delete( name );
        this.#pendingSubscribe.delete( name );
        this.#pendingUnsubscribe.add( name );

        return true;
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
            this.#connection.voidCall( "/subscribe", [...this.#pendingSubscribe] );

            this.#pendingSubscribe.clear();
        }

        // unsubscribe
        if ( this.#pendingUnsubscribe.size ) {
            this.#connection.voidCall( "/unsubscribe", [...this.#pendingUnsubscribe] );

            this.#pendingUnsubscribe.clear();
        }
    }
}
