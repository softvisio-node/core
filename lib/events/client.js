import * as uuid from "#lib/uuid";

export default class EventsClient {
    #id;
    #localEvents;
    #localListeners = {};
    #remoteListeners = new Set();

    #hub;
    #hubSubscribePrefixes;
    #hubSubscribeListener;
    #hubListenerers = {};
    #hubSend;
    #hubReceive;

    constructor ( localEvents ) {
        this.#localEvents = new Set( localEvents );
    }

    // properties
    get id () {
        this.#id ??= uuid.v4();

        return this.#id;
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

    link ( hub, { send, receive } ) {
        if ( this.#hub ) this.unlink();

        this.#hub = hub;

        // subscribe to the updates
        if ( receive ) {
            const prefixes = Object.keys( receive );

            if ( prefixes.length ) {
                this.#hubSubscribePrefixes = prefixes;

                this.#hubSubscribeListener = this.#hubSubscribeListenerTemplate.bind( this );

                hub.subscribe( this.#hubSubscribePrefixes, this.#hubSubscribeListener );
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

        this.#hub = null;
        this.#hubSend = null;
        this.#hubReceive = null;
    }

    // protected
    _canSubscribe ( name ) {
        return true;
    }

    _subscribeToRemote ( name ) {}

    _unsubscribeToRemote ( name ) {}

    _publishToRemote ( name, args ) {}

    // XXX
    _onSubscribeFromRemote ( name ) {

        // remote can't subscrube on reserved events
        if ( this.#localEvents.has( name ) ) return;

        // event is rejected
        if ( !this._canSubscribe( name ) ) return;

        // already subscribed
        if ( this.#remoteListeners.has( name ) ) return;

        this.#remoteListeners.add( name );

        this.#hubSetListener( name );
    }

    // XXX
    _onUnsubscribeFromRemote ( name ) {

        // not subscribed
        if ( !this.#remoteListeners.has( name ) ) return;

        this.#remoteListeners.delete( name );

        this.#hubDeleteListener( name );
    }

    // XXX publish to local, publish to hub
    _onPublishFromRemote ( [name, args] ) {

        // reserved name
        if ( this.#localEvents.has( name ) ) return;

        this.#publishToLocal( name, args );

        this.#publishToHub( name, args );
    }

    // private
    #setLocalListener ( name, listener, once ) {
        const listeners = ( this.#localListeners[name] ||= new Map() );

        listeners.set( listener, once );

        // local event
        if ( this.#localEvents.has( name ) ) return;

        // listen on hub
        this.#hubSetListener( name );

        // new listener
        if ( listeners.size === 1 ) this._subscribeToRemote( name );
    }

    #deleteLocalListener ( name, listener ) {
        const listeners = this.#localListeners[name];

        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            delete this.#localListeners[name];

            // local event
            if ( this.#localEvents.has( name ) ) return;

            this._unsubscribeToRemote( name );
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

        this.#hub.publish( hubPrefix, name, args, this.id );
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

            this._unsubscribeToRemote( name );
        }
    }

    #hubSetListener ( name ) {
        if ( !this.#hubReceive ) return;

        // local event
        if ( this.#localEvents.has( name ) ) return;

        const localPrefix = name.substr( 0, name.indexOf( ":" ) );

        for ( const hubPrefix in this.#hubReceive ) {

            // local prefix is not match rule
            if ( localPrefix !== this.#hubReceive[hubPrefix] ) continue;

            // already listening
            if ( this.#hubListenerers[name] ) continue;

            // create listener
            const listener = this.#onPublishFromHub.bind( this, localPrefix );

            // register listener
            this.#hubListenerers[name] = [hubPrefix, name, listener];

            // set listener
            this.#hub.on( hubPrefix, name, listener, this.id );
        }
    }

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
