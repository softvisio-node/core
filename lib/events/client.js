import * as uuid from "#lib/uuid";

export default class EventsClient {
    #id;
    #localEvents; // XXX rename to localEvents
    #local = {};
    #remote = new Set();

    #hub;
    #hubSubscribePrefixes;
    #hubSubscribeListener;
    #hubListeners = new Map();
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

    // XXX
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
        if ( this.#remote.size ) this.#remote.forEach( name => this.#hubListen( name ) );
    }

    // XXX
    unlink () {
        if ( !this.#hub ) return;

        if ( this.#hubSubscribeListener ) {
            this.#hub.unsubscribe( this.#hubSubscribePrefixes, this.#hubSubscribeListener );

            this.#hubSubscribePrefixes = null;
            this.#hubSubscribeListener = null;
        }

        if ( this.#hubListeners.size ) {
            this.#hubListeners.forEach( ( listener, name ) => this.#hub.off( name, listener ) );
            this.#hubListeners.clear();
        }

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
        if ( this.#remote.has( name ) ) return;

        this.#remote.add( name );

        this.#hubListen( name );
    }

    // XXX
    _onUnsubscribeFromRemote ( name ) {

        // not subscribed
        if ( !this.#remote.has( name ) ) return;

        this.#remote.delete( name );

        this.#hubOff( name );
    }

    // XXX
    _onPublishFromRemote ( [name, args] ) {

        // reserved name
        if ( this.#localEvents.has( name ) ) return;

        this.#publishToLocal( name, args );

        this.#publishToHub( name, args );
    }

    // private
    #setLocalListener ( name, listener, once ) {
        const listeners = ( this.#local[name] ||= new Map() );

        listeners.set( listener, once );

        // local event
        if ( this.#localEvents.has( name ) ) return;

        // listen on hub
        this.#hubListen( name );

        // new listener
        if ( listeners.size === 1 ) this._subscribeToRemote( name );
    }

    #deleteLocalListener ( name, listener ) {
        const listeners = this.#local[name];

        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            delete this.#local[name];

            // local event
            if ( this.#localEvents.has( name ) ) return;

            this._unsubscribeToRemote( name );
        }
    }

    #publishToLocal ( name, args ) {
        const listeners = this.#local[name];

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

    // XXX
    #publishToRemote ( name, args ) {

        // reserved name
        if ( this.#localEvents.has( name ) ) return;

        if ( !this.#remote.has( name ) ) return;

        this._publishToRemote( name, args );
    }

    // XXX
    #hubSubscribeListenerTemplate ( type, prefix, name ) {

        // subscribe
        if ( type === "subscribe" ) {

            // already subscribed
            if ( this.#remote.has( name ) ) return;

            this._subscribeToRemote( name );
        }

        // unsubscribe
        else {

            // already unsubscribed
            if ( !this.#remote.has( name ) ) return;

            this._unsubscribeToRemote( name );
        }
    }

    // XXX
    #hubListen ( name ) {
        if ( !this.#hubReceive ) return;

        // local event
        if ( this.#localEvents.has( name ) ) return;

        const localPrefix = name.substr( 0, name.indexOf( ":" ) );

        // if ( hubPrefix ) name = name.substring( localPrefix.length + 1 );

        for ( const hubPrefix in this.#hubReceive ) {
            if ( localPrefix !== this.#hubReceive[hubPrefix] ) continue;

            const id = hubPrefix + ":" + name;

            // XXX
            // already listening
            if ( this.#hubListeners.has( id ) ) continue;

            // create listener
            const listener = this.#onPublishFromHub.bind( this, localPrefix );

            // register listener
            // XXX
            this.#hubListeners.set( id, listener );

            // set listener
            this.#hub.on( hubPrefix, name, listener, this.id );
        }
    }

    // XXX
    #hubOff ( name ) {

        // not linked
        if ( !this.#hub ) return;

        const listener = this.#hubListeners.get( name );

        // not subscribed
        if ( !listener ) return;

        // delete listener
        this.#hub.off( name, listener );

        // unregister listener
        this.#hubListeners.delete( name );
    }

    // XXX
    #onPublishFromHub ( prefix, name, args ) {
        if ( prefix ) name = prefix + ":" + name;

        this.#publishToLocal( name, args );
        this.#publishToRemote( name, args );
    }
}
