var ID = 0;

export default class EventsClient {
    #id = ++ID;
    #localEvents;
    #localListeners = {};
    #remoteListeners = new Set();

    #hub;
    #hubSubscribePrefixes;
    #hubSubscribeListener;
    #hubListenerers = {};
    #hubListenerersCount = {};
    #hubSend;
    #hubReceive;

    constructor ( localEvents ) {
        this.#localEvents = new Set( localEvents );
    }

    // properties
    get isHubLinked () {
        return !!this.#hub;
    }

    // public
    on ( name, listener ) {
        this.#setLocalListener( name, listener, false );
    }

    once ( name, listener ) {
        this.#setLocalListener( name, listener, true );
    }

    off ( name, listener ) {
        this.#deleteLocalListener( name, listener );
    }

    emit ( name, ...args ) {
        this.#publishToLocal( name, args );

        this.#publishToHub( name, args );
    }

    publish ( name, ...args ) {
        this.#publishToLocal( name, args );
        this.#publishToHub( name, args );
        this.#publishToRemote( name, args );
    }

    // XXX subscribe remote to hub events prefixes
    link ( hub, { send, receive } ) {
        if ( this.#hub ) this.unlink();

        this.#hub = hub;

        // subscribe to the updates
        if ( receive ) {
            const hubPrefixes = Object.keys( receive );

            if ( hubPrefixes.length ) {
                this.#hubSubscribePrefixes = hubPrefixes;

                this.#hubSubscribeListener = this.#hubSubscribeListenerTemplate.bind( this );

                hub.subscribe( hubPrefixes, this.#hubSubscribeListener );
            }
        }

        this.#hubSend = send;
        this.#hubReceive = receive;

        // set listeners on already subscribed events
        for ( const name in this.#localListeners ) this.#hubSetListener( name );

        if ( this.#remoteListeners.size ) this.#remoteListeners.forEach( name => this.#hubSetListener( name ) );
    }

    unlink () {
        if ( !this.#hub ) return;

        // remove hun subscribe listener
        if ( this.#hubSubscribeListener ) {
            this.#hub.unsubscribe( this.#hubSubscribePrefixes, this.#hubSubscribeListener );

            this.#hubSubscribePrefixes = null;
            this.#hubSubscribeListener = null;
        }

        // remove hub events listeners
        for ( const args of Object.values( this.#hubListenerers ) ) this.#hub.off( ...args );
        this.#hubListenerers = {};
        this.#hubListenerersCount = {};

        this.#hub = null;
        this.#hubSend = null;
        this.#hubReceive = null;
    }

    // protected
    _canSubscribe ( name ) {
        return true;
    }

    _subscribeToRemote ( name ) {}

    _unsubscribeFromRemote ( name ) {}

    _publishToRemote ( name, args ) {}

    _onRemoteSubscribe ( name ) {

        // remote can't subscribe to local events
        if ( this.#localEvents.has( name ) ) return;

        // event is rejected
        if ( !this._canSubscribe( name ) ) return;

        // already subscribed
        if ( this.#remoteListeners.has( name ) ) return;

        this.#remoteListeners.add( name );

        // subscribe on hub
        this.#hubSetListener( name );
    }

    // XXX
    _onRemoteUnsubscribe ( name ) {

        // not subscribed
        if ( !this.#remoteListeners.has( name ) ) return;

        // unregister remote listener
        this.#remoteListeners.delete( name );

        // unsubscribe on hub
        this.#hubDeleteListener( name );
    }

    _onRemoteUnsubscribeAll () {
        this.#remoteListeners.forEach( name => this._onRemoteUnsubscribe( name ) );
    }

    // XXX publish to local, publish to hub
    _onRemotePublish ( [name, args] ) {

        // reserved name
        if ( this.#localEvents.has( name ) ) return;

        this.#publishToLocal( name, args );

        this.#publishToHub( name, args );
    }

    // private
    // XXX subscrive on remote if not local event
    #setLocalListener ( name, listener, once ) {
        const listeners = ( this.#localListeners[name] ||= new Map() );

        listeners.set( listener, once );

        // local event
        if ( this.#localEvents.has( name ) ) return;

        // new listener
        if ( listeners.size === 1 ) {

            // listen on hub
            this.#hubSetListener( name );

            // listen remote
            this._subscribeToRemote( name );
        }
    }

    // XXX unsubscribe from rempte
    #deleteLocalListener ( name, listener ) {
        const listeners = this.#localListeners[name];

        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            delete this.#localListeners[name];

            // local event
            if ( this.#localEvents.has( name ) ) return;

            // unsubscribe on hub
            this.#hubDeleteListener( name );

            // unsubscribe on remote
            this._unsubscribeFromRemote( name );
        }
    }

    #publishToLocal ( name, args ) {
        const listeners = this.#localListeners[name];

        if ( listeners ) {
            listeners.forEach( ( once, listener ) => {
                if ( once ) this.#deleteLocalListener( name, listener );

                listener( ...args );
            } );
        }
    }

    #publishToHub ( name, args ) {
        if ( !this.#hub ) return;

        const localPrefix = name.substr( 0, name.indexOf( ":" ) ),
            hubPrefix = this.#hubSend[localPrefix];

        if ( !hubPrefix ) return;

        if ( localPrefix ) name = name.substring( localPrefix.length + 1 );

        this.#hub.publish( hubPrefix, name, args, this.#id );
    }

    #publishToRemote ( name, args ) {

        // local event
        if ( this.#localEvents.has( name ) ) return;

        // remote client is not listening for this event
        if ( !this.#remoteListeners.has( name ) ) return;

        this._publishToRemote( name, args );
    }

    // XXX subscribe / unsubscribe remote
    #hubSubscribeListenerTemplate ( type, prefix, name ) {

        // subscribe
        if ( type === "subscribe" ) {

            // already subscribed
            if ( this.#remoteListeners.has( name ) ) return;

            this._subscribeToRemote( name );
        }

        // unsubscribe
        else {

            // already unsubscribed
            if ( !this.#remoteListeners.has( name ) ) return;

            this._unsubscribeFromRemote( name );
        }
    }

    // XXX count number of listeners
    #hubSetListener ( name ) {
        if ( !this.#hubReceive ) return;

        // local event
        if ( this.#localEvents.has( name ) ) return;

        const localPrefix = name.substr( 0, name.indexOf( ":" ) );
        if ( localPrefix ) name = name.substring( localPrefix.length + 1 );

        for ( const hubPrefix in this.#hubReceive ) {

            // local prefix is not match rule
            if ( localPrefix !== this.#hubReceive[hubPrefix] ) continue;

            const hubListenerId = hubPrefix + ":" + name;

            // already listening
            if ( this.#hubListenerersCount[hubListenerId] ) {
                this.#hubListenerersCount[hubListenerId]++;
                continue;
            }

            this.#hubListenerersCount[hubListenerId] ??= 0;
            this.#hubListenerersCount[hubListenerId]++;

            // create listener
            const listener = this.#onPublishFromHub.bind( this, localPrefix );

            // register listener
            this.#hubListenerers[hubListenerId] = [hubPrefix, name, listener];

            // set listener
            this.#hub.on( hubPrefix, name, listener, this.#id );
        }
    }

    // XXX count number of listeners
    #hubDeleteListener ( name ) {

        // not linked
        if ( !this.#hub ) return;

        const args = this.#hubListenerers[name];

        // not subscribed
        if ( !args ) return;

        // delete listener
        this.#hub.off( ...args );

        // unregister listener
        delete this.#hubListenerers[name];
    }

    #onPublishFromHub ( localPrefix, name, args ) {
        if ( localPrefix ) name = localPrefix + ":" + name;

        this.#publishToLocal( name, args );
        this.#publishToRemote( name, args );
    }
}
