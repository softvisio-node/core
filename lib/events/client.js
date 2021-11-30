import * as uuid from "#lib/uuid";

const RESERVED = ["subscribe", "unsubscribe", "publish", "emit"];

export default class EventsClient {
    #id;
    #reservedEvents;
    #local = {};
    #remote = new Set();

    #hub;
    #hubPrefix = "";
    #hubSubscribeListener;
    #hubUnsubscribeListener;
    #hubListeners = new Map();

    constructor ( reservedEvents ) {
        this.#reservedEvents = new Set( [...RESERVED, ...( reservedEvents || [] )] );
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

    link ( hub ) {
        if ( this.#hub ) this.unlink();

        this.#hub = hub;

        this.#hubSubscribeListener = this.#hubOnSubscribeListener.bind( this );
        hub.on( "subscribe", this.#hubSubscribeListener );

        this.#hubUnsubscribeListener = this.#hubOnUnsubscribeListener.bind( this );
        hub.on( "unsubscribe", this.#hubUnsubscribeListener );

        // set listeners on already subscribed events
        if ( this.#remote.size ) this.#remote.forEach( name => this.#hubOn( name ) );
    }

    unlink () {
        if ( !this.#hub ) return;

        this.#hub.off( "subscribe", this.#hubSubscribeListener );
        this.#hubSubscribeListener = null;

        this.#hub.off( "unsubscribe", this.#hubUnsubscribeListener );
        this.#hubUnsubscribeListener = null;

        if ( this.#hubListeners.size ) {
            this.#hubListeners.forEach( ( listener, name ) => this.#hub.off( name, listener ) );
            this.#hubListeners.clear();
        }

        this.#hub = null;
    }

    // protected
    _canSubscribe ( name ) {
        return true;
    }

    _subscribeToRemote ( name ) {}

    _unsubscribeToRemote ( name ) {}

    _publishToRemote ( name, args ) {}

    _onSubscribeFromRemote ( name ) {

        // remote can't subscrube on reserved events
        if ( this.#reservedEvents.has( name ) ) return;

        // event is rejected
        if ( !this._canSubscribe( name ) ) return;

        // already subscribed
        if ( this.#remote.has( name ) ) return;

        this.#remote.add( name );

        this.#hubOn( name );
    }

    _onUnsubscribeFromRemote ( name ) {

        // not subscribed
        if ( !this.#remote.has( name ) ) return;

        this.#remote.delete( name );

        this.#hubOff( name );
    }

    _onPublishFromRemote ( [name, args] ) {

        // reserved name
        if ( this.#reservedEvents.has( name ) ) return;

        this.#publishToLocal( name, args );

        this.#publishToHub( name, args );
    }

    // private
    #setLocalListener ( name, listener, once ) {
        const listeners = ( this.#local[name] ||= new Map() );

        listeners.set( listener, once );

        // reserved name
        if ( this.#reservedEvents.has( name ) ) return;

        // new listener
        if ( listeners.size === 1 ) this._subscribeToRemote( name );
    }

    #deleteLocalListener ( name, listener ) {
        const listeners = this.#local[name];

        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            delete this.#local[name];

            if ( this.#reservedEvents.has( name ) ) return;

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

    // XXX client id, prefix
    #publishToHub ( name, args ) {
        if ( !this.#hub ) return;

        this.#hub.publish( this.#hubPrefix + name, args );
    }

    // XXX
    #publishToRemote ( name, args ) {

        // reserved name
        if ( this.#reservedEvents.has( name ) ) return;

        if ( !this.#remote.has( name ) ) return;

        this._publishToRemote( name, args );
    }

    // XXX - local, reserved events
    #hubOnSubscribeListener ( name ) {

        // already subscribed
        if ( this.#remote.has( name ) ) return;

        this._subscribeToRemote( name );
    }

    // XXX - local, reserved events
    #hubOnUnsubscribeListener ( name ) {

        // already unsubscribed
        if ( !this.#remote.has( name ) ) return;

        this._unsubscribeToRemote( name );
    }

    #hubOn ( name ) {

        // already listen
        if ( !this.#hub || this.#hubListeners.has( name ) ) return;

        // create listener
        const listener = this._publishToRemote.bind( this, name );

        // register listener
        this.#hubListeners.set( name, listener );

        // set listener
        this.#hub.on( name, listener );
    }

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
}
