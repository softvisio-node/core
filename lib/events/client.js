export default class EventsClient {
    #reservedEvents;
    #local = new Map();
    #remote = new Set();

    constructor ( reservedEvents ) {
        this.#reservedEvents = new Set( reservedEvents );
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
        if ( this.#reservedEvents.has( name ) ) this.#emit( name, args );
    }

    publish ( name, ...args ) {

        // reserved name
        if ( this.#reservedEvents.has( name ) ) return;

        if ( !this.#remote.has( name ) ) return;

        this._publish( name, args );
    }

    // protected
    _subscribe ( name ) {}

    _unsubscribe ( name ) {}

    _publish ( name, args ) {}

    _onSubscribe ( name ) {
        this.#remote.add( name );
    }

    _onUnsubscribe ( name ) {
        this.#remote.delete( name );
    }

    _onPublish ( [name, args] ) {

        // reserved name
        if ( this.#reservedEvents.has( name ) ) return;

        this.#emit( name, args );
    }

    // private
    #setLocalListener ( name, listener, once ) {
        var listeners = this.#local.get( name );

        if ( !listeners ) {
            listeners = new Map();

            this.#local.set( name, listeners );
        }

        listeners.set( listener, once );

        // reserved name
        if ( this.#reservedEvents.has( name ) ) return;

        // new listener
        if ( listeners.size === 1 ) this._subscribe( name );
    }

    #deleteLocalListener ( name, listener ) {
        const listeners = this.#local.get( name );

        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            this.#local.delete( name );

            if ( this.#reservedEvents.has( name ) ) return;

            this._unsubscribe( name );
        }
    }

    #emit ( name, args ) {
        const listeners = this.#local.get( name );

        if ( !listeners ) return;

        listeners.forEach( ( once, listener ) => {
            if ( once ) this.#deleteLocalListener( name, listener );

            listener( ...args );
        } );
    }
}
