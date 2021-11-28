const RESERVED_EVENTS = ["subscribe", "unsubscribe", "publish"];

export default class EventsHub {
    #reservedEvents = new Set();
    #reservedListeners = {};
    #localListeners = {};
    #localEvents = new Set(); // locally subscribed event names
    #remoteEvents = new Set();
    #forwarders = new Map();

    #hasNextTick;
    #pendingCallbacks = [];
    #pendingSubscribeOnRemote = new Set();
    #pendingUnsubscribeOnRemote = new Set();

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
        this.#subscribeLocal( name, listener, { "once": false } );
    }

    once ( name, listener ) {
        this.#subscribeLocal( name, listener, { "once": true } );
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
            this.#unsubscribeLocal( name, listener );
        }
    }

    publish ( names, ...args ) {
        if ( !Array.isArray( names ) ) names = [names];

        const subscribedNames = names.filter( name => this.#remoteEvents.has( name ) );

        if ( subscribedNames.length ) this._publishToRemote( subscribedNames, args );
    }

    forward ( hub, filter ) {
        this.unforward( hub );

        const subscribedNames = {};

        const forwarder = ( subscribedName, args ) => {
            hub.publish( subscribedName, ...args );
        };

        const subscribe = names => {
            for ( const subscribedName of names ) {
                let forwardedName;

                // filter event names
                if ( filter ) {

                    // translate subscribed event name
                    forwardedName = filter( subscribedName );

                    // ignore event
                    if ( !forwardedName ) continue;
                }
                else {

                    // forward event without name translation
                    forwardedName = subscribedName;
                }

                subscribedNames[subscribedName] = forwardedName;

                // set on-forward listener
                this.#subscribeLocal( forwardedName, forwarder, { subscribedName } );
            }
        };

        const unsubscribe = names => {
            for ( const subscribedName of names ) {

                // remove forwarders for unsubscribed event
                if ( subscribedName in subscribedNames ) {
                    delete subscribedNames[subscribedName];

                    this.off( subscribedName, forwarder );
                }
            }
        };

        hub.on( "subscribe", subscribe );
        hub.on( "unsubscribe", unsubscribe );

        this.#forwarders.set( hub, {
            subscribedNames,
            forwarder,
            subscribe,
            unsubscribe,
        } );
    }

    unforward ( hub ) {
        const listeners = this.#forwarders.get( hub );

        if ( !listeners ) return;

        this.#forwarders.delete( hub );

        hub.off( "subscribe", listeners.subscribe );
        hub.off( "unsubscribe", listeners.unsubscribe );

        for ( const subscribedName in listeners.subscribedNames ) this.off( listeners.subscribedNames[subscribedName], listeners.forwarder );
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
    #subscribeLocal ( name, listener, options ) {

        // reserved event
        if ( this.reservedEvents.has( name ) ) {
            let listeners = this.#reservedListeners[name];

            listeners ??= this.#reservedListeners[name] = new Map();

            listeners.set( listener, options );
        }

        // remote event
        else {
            let listeners = this.#localListeners[name];

            listeners ??= this.#localListeners[name] = new Map();

            listeners.set( listener, options );

            if ( !this.#localEvents.has( name ) ) {
                this.#localEvents.add( name );

                this.#pendingSubscribeOnRemote.add( name );
                if ( this.#pendingUnsubscribeOnRemote.has( name ) ) this.#pendingUnsubscribeOnRemote.delete( name );

                // schedule
                if ( !this.#hasNextTick ) this.#setNextTick();
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

            this.#pendingUnsubscribeOnRemote.add( name );
            if ( this.#pendingSubscribeOnRemote.has( name ) ) this.#pendingSubscribeOnRemote.delete( name );

            // schedule
            if ( !this.#hasNextTick ) this.#setNextTick();
        }
    }

    #emit ( name, args ) {

        // reserved event
        if ( this.reservedEvents.has( name ) ) {
            const listeners = this.#reservedListeners[name];

            if ( !listeners ) return;

            listeners.forEach( ( options, listener ) => {

                // once
                if ( options.once ) this.off( name, listener );

                this.#pendingCallbacks.push( () => listener( ...args ) );
            } );

            // schedule
            if ( !this.#hasNextTick ) this.#setNextTick();
        }

        // remote event
        else {
            const listeners = this.#localListeners[name];

            if ( !listeners ) return;

            listeners.forEach( ( options, listener ) => {

                // forward
                if ( options.subscribedName ) {
                    this.#pendingCallbacks.push( () => listener( options.subscribedName, args ) );
                }

                // emit
                else {

                    // once
                    if ( options.once ) this.#unsubscribeLocal( name, listener );

                    this.#pendingCallbacks.push( () => listener( ...args ) );
                }
            } );

            // schedule
            if ( !this.#hasNextTick ) this.#setNextTick();
        }
    }

    #setNextTick () {
        if ( this.#hasNextTick ) return;

        this.#hasNextTick = true;
        process.nextTick( this.#nextTick.bind( this ) );
    }

    #nextTick () {
        this.#hasNextTick = false;

        if ( this.#pendingSubscribeOnRemote.size ) {
            this._subscribeOnRemote( [...this.#pendingSubscribeOnRemote] );
            this.#pendingSubscribeOnRemote.clear();
        }

        if ( this.#pendingUnsubscribeOnRemote.size ) {
            this._unsubscribeOnRemote( [...this.#pendingUnsubscribeOnRemote] );
            this.#pendingUnsubscribeOnRemote.clear();
        }

        if ( this.#pendingCallbacks.length ) {
            const callbacks = this.#pendingCallbacks;

            this.#pendingCallbacks = [];

            for ( const callback of callbacks ) callback();
        }
    }
}
