const RESERVED_EVENTS = ["subscribe", "unsubscribe", "publish"];

export default class EventsHub {
    #reservedEvents = new Set();
    #reservedListeners = {};
    #localListeners = {};
    #localEvents = new Set(); // locally subscribed event names
    #remoteEvents = new Set();
    #forwarders = new Map();

    constructor ( reservedEvents = [] ) {
        this.#reservedEvents = new Set( [...RESERVED_EVENTS, ...reservedEvents] );
    }

    // properties
    get reservedEvents () {
        return this.#reservedEvents;
    }

    get localEvents () {
        return [...this.#localEvents];
    }

    // public
    on ( name, listener ) {
        this.#subscribeLocal( name, listener, false );
    }

    once ( name, listener ) {
        this.#subscribeLocal( name, listener, true );
    }

    onForward ( name, listener ) {
        this.#subscribeLocal( name, listener, null );
    }

    off ( name, listener ) {

        // reserved event
        if ( this.reservedEvents.has( name ) ) {
            const listeners = this.#reservedListeners[name];

            if ( !listeners ) return;

            listeners.delete( listener );

            if ( !listeners.size ) delete this.#reservedListeners[name];
        }

        // remote event
        else {
            if ( this.#unsubscribeLocal( name, listener ) ) this._unsubscribeOnRemote( [name] );
        }
    }

    publish ( names, ...args ) {
        if ( !Array.isArray( names ) ) names = [names];

        const subscribedNames = names.filter( name => this.#remoteEvents.has( name ) );

        if ( subscribedNames.length ) this._publishToRemote( subscribedNames, args );
    }

    forward ( hub ) {
        this.unforward( hub );

        const subscribedNames = new Set();

        // XXX transform event name
        const forwarder = ( name, args ) => {

            // XXX transform event name

            hub.publish( name, ...args );
        };

        // XXX validate event name
        const subscribe = names => {
            for ( const name of names ) {

                // XXX filter even name using provided prefix

                this.onForward( name, forwarder );

                subscribedNames.add( name );
            }
        };

        // XXX
        const unsubscribe = names => {
            for ( const name of names ) {
                this.off( name, forwarder );

                subscribedNames.delete( name );
            }
        };

        hub.on( "subscribe", subscribe );
        hub.on( "unsubscribe", unsubscribe );

        this.#forwarders.set( hub, {
            subscribe,
            unsubscribe,
            forwarder,
            subscribedNames,
        } );
    }

    unforward ( hub ) {
        const listeners = this.#forwarders.get( hub );

        if ( !listeners ) return;

        this.#forwarders.delete( hub );

        hub.off( "subscribe", listeners.subscribe );
        hub.off( "unsubscribe", listeners.unsubscribe );

        listeners.subscribedNames.forEach( name => this.off( name, listeners.forwarder ) );
    }

    // protected
    _addReservedEvents ( reservedEvents ) {
        this.#reservedEvents = new Set( [...this.#reservedEvents, ...reservedEvents] );
    }

    _validateRemoteEventName ( name ) {
        return name;
    }

    _subscribeOnRemote ( names ) {}

    _unsubscribeOnRemote ( names ) {}

    _publishToRemote ( names, args ) {}

    _onRemoteSubscribe ( names ) {
        if ( !names ) return;

        if ( !Array.isArray( names ) ) names = [names];

        const subscribedEvents = [];

        for ( let name of names ) {

            // reserved evend
            if ( this.#reservedEvents.has( name ) ) continue;

            // validate remote event name
            name = this._validateRemoteEventName( name );

            // remote event ename is not valid, subscribe is declined
            if ( !name ) continue;

            if ( !this.#remoteEvents.has( name ) ) {
                this.#remoteEvents.add( name );

                subscribedEvents.push( name );
            }
        }

        if ( subscribedEvents.length ) this.#emit( "subscribe", [subscribedEvents] );
    }

    _onRemoteUnsubscribe ( names ) {
        if ( !names ) return;

        if ( !Array.isArray( names ) ) names = [names];

        const unsubscribedEvents = [];

        for ( const name of names ) {

            // reserved evend
            if ( this.#reservedEvents.has( name ) ) continue;

            if ( this.#remoteEvents.has( name ) ) {
                this.#remoteEvents.delete( name );

                unsubscribedEvents.push( name );
            }
        }

        if ( unsubscribedEvents.length ) this.#emit( "unsubscribe", [unsubscribedEvents] );
    }

    _onRemoteUnsubscribeAll () {
        if ( !this.#remoteEvents.size ) return;

        const unsubscribedEvents = [...this.#remoteEvents];

        this.#remoteEvents.clear();

        this.#emit( "unsubscribe", unsubscribedEvents );
    }

    _onRemotePublish ( names, args ) {
        if ( !Array.isArray( names ) ) names = [names];

        const emitted = {};

        for ( const name of names ) {
            if ( emitted[name] ) continue;

            emitted[name] = true;

            // reserved event
            if ( this.#reservedEvents.has( name ) ) {
                try {
                    this._onRemotePublishReserved( name );
                }
                catch ( e ) {}
            }
            else {
                this.#emit( name, args );
                this.#emit( "publish", [name, args] );
            }
        }
    }

    _onRemotePublishReserved ( name ) {
        throw Error( `Event name "${name}" is reserved` );
    }

    // private
    #subscribeLocal ( name, listener, once ) {

        // reserved event
        if ( this.reservedEvents.has( name ) ) {
            let listeners = this.#reservedListeners[name];

            listeners ??= this.#reservedListeners[name] = new Map();

            listeners.set( listener, once );
        }

        // remote event
        else {
            let listeners = this.#localListeners[name];

            listeners ??= this.#localListeners[name] = new Map();

            listeners.set( listener, once );

            if ( !this.#localEvents.has( name ) ) {
                this.#localEvents.add( name );

                this._subscribeOnRemote( [name] );
            }
        }
    }

    #unsubscribeLocal ( name, listener ) {
        const listeners = this.#localListeners[name];

        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            delete this.#localListeners[name];

            this.#localEvents.delete( name );

            return true;
        }
    }

    #emit ( name, args ) {

        // reserved event
        if ( this.reservedEvents.has( name ) ) {
            const listeners = this.#reservedListeners[name];

            if ( !listeners ) return;

            listeners.forEach( ( once, listener ) => {

                // once
                if ( once ) this.off( name, listener );

                process.nextTick( () => listener( ...args ) );
            } );
        }

        // remote event
        else {
            const listeners = this.#localListeners[name];

            if ( !listeners ) return;

            const unsubscribedEvents = [];

            listeners.forEach( ( once, listener ) => {

                // once
                if ( once && this.#unsubscribeLocal( name, listener ) ) unsubscribedEvents.push( name );

                // forward
                if ( once == null ) process.nextTick( () => listener( name, args ) );

                // emit
                else process.nextTick( () => listener( ...args ) );
            } );

            if ( unsubscribedEvents.length ) this._unsubscribeOnRemote( unsubscribedEvents );
        }
    }
}
