import * as uuid from "#lib/uuid";

const RESERVED = ["subscribe", "unsubscribe", "publish", "emit"];

export default class EventsClient {
    #id;
    #reservedEvents;
    #local = {};
    #remote = new Set();

    #link;
    #linkSubscribeListener;
    #linkUnsubscribeListener;
    #linkListeners = new Map();

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
        this.#emit( name, args );
    }

    publish ( name, ...args ) {

        // reserved name
        if ( this.#reservedEvents.has( name ) ) return;

        if ( !this.#remote.has( name ) ) return;

        this._publish( name, args );
    }

    link ( hub ) {
        if ( this.#link ) this.unlink();

        this.#link = hub;

        this.#linkSubscribeListener = this.#linkOnSubscribeListener.bind( this );
        hub.on( "subscribe", this.#linkSubscribeListener );

        this.#linkUnsubscribeListener = this.#linkOnUnsubscribeListener.bind( this );
        hub.on( "unsubscribe", this.#linkUnsubscribeListener );

        // set listeners on already subscribed events
        if ( this.#remote.size ) this.#remote.forEach( name => this.#linkOn( name ) );
    }

    unlink () {
        if ( !this.#link ) return;

        this.#link.off( "subscribe", this.#linkSubscribeListener );
        this.#linkSubscribeListener = null;

        this.#link.off( "unsubscribe", this.#linkUnsubscribeListener );
        this.#linkUnsubscribeListener = null;

        if ( this.#linkListeners.size ) {
            this.#linkListeners.forEach( ( listener, name ) => this.#link.off( name, listener ) );
            this.#linkListeners.clear();
        }

        this.#link = null;
    }

    // protected
    _canSubscribe ( name ) {
        return true;
    }

    _subscribe ( name ) {}

    _unsubscribe ( name ) {}

    _publish ( name, args ) {}

    _onSubscribe ( name ) {

        // remote can't subscrube on reserved events
        if ( this.#reservedEvents.has( name ) ) return;

        // event is rejected
        if ( !this._canSubscribe( name ) ) return;

        // already subscribed
        if ( this.#remote.has( name ) ) return;

        this.#remote.add( name );

        this.#linkOn( name );
    }

    _onUnsubscribe ( name ) {

        // not subscribed
        if ( !this.#remote.has( name ) ) return;

        this.#remote.delete( name );

        this.#linkOff( name );
    }

    _onPublish ( [name, args] ) {

        // reserved name
        if ( this.#reservedEvents.has( name ) ) return;

        this.#emit( name, args );
    }

    // private
    #setLocalListener ( name, listener, once ) {
        const listeners = ( this.#local[name] ||= new Map() );

        listeners.set( listener, once );

        // reserved name
        if ( this.#reservedEvents.has( name ) ) return;

        // new listener
        if ( listeners.size === 1 ) this._subscribe( name );
    }

    #deleteLocalListener ( name, listener ) {
        const listeners = this.#local[name];

        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            delete this.#local[name];

            if ( this.#reservedEvents.has( name ) ) return;

            this._unsubscribe( name );
        }
    }

    #emit ( name, args ) {
        const listeners = this.#local[name];

        // publish to the local listeners
        if ( listeners ) {
            listeners.forEach( ( once, listener ) => {
                if ( once ) this.#deleteLocalListener( name, listener );

                listener( ...args );
            } );
        }

        // publish to the linked hub
        if ( this.#link ) this.#link.publish( name, args );
    }

    // XXX - local, reserved events
    #linkOnSubscribeListener ( name ) {

        // already subscribed
        if ( this.#remote.has( name ) ) return;

        this._subscribe( name );
    }

    // XXX - local, reserved events
    #linkOnUnsubscribeListener ( name ) {

        // already unsubscribed
        if ( !this.#remote.has( name ) ) return;

        this._unsubscribe( name );
    }

    #linkOn ( name ) {

        // already listen
        if ( !this.#link || this.#linkListeners.has( name ) ) return;

        // create listener
        const listener = this._publish.bind( this, name );

        // register listener
        this.#linkListeners.set( name, listener );

        // set listener
        this.#link.on( name, listener );
    }

    #linkOff ( name ) {

        // not linked
        if ( !this.#link ) return;

        const listener = this.#linkListeners.get( name );

        // not subscribed
        if ( !listener ) return;

        // delete listener
        this.#link.off( name, listener );

        // unregister listener
        this.#linkListeners.delete( name );
    }
}
