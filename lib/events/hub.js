const RESERVED_EVENTS = ["subscribe", "unsubscribe", "publish"];

// TODO bulk remote subscribe / unsubscribe, trigger send on next tick

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
            if ( this.#unsubscribeLocal( name, listener ) ) this._unsubscribeOnRemote( [name] );
        }
    }

    publish ( names, ...args ) {
        if ( !Array.isArray( names ) ) names = [names];

        const subscribedNames = names.filter( name => this.#remoteEvents.has( name ) );

        if ( subscribedNames.length ) this._publishToRemote( subscribedNames, args );
    }

    // XXX
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

            listeners.forEach( ( options, listener ) => {

                // once
                if ( options.once ) this.off( name, listener );

                process.nextTick( () => listener( ...args ) );
            } );
        }

        // remote event
        else {
            const listeners = this.#localListeners[name];

            if ( !listeners ) return;

            const unsubscribedEvents = [];

            listeners.forEach( ( options, listener ) => {

                // forward
                if ( options.subscribedName ) {
                    process.nextTick( () => listener( options.subscribedName, args ) );
                }

                // emit
                else {

                    // once
                    if ( options.once && this.#unsubscribeLocal( name, listener ) ) unsubscribedEvents.push( name );

                    process.nextTick( () => listener( ...args ) );
                }
            } );

            if ( unsubscribedEvents.length ) this._unsubscribeOnRemote( unsubscribedEvents );
        }
    }
}
