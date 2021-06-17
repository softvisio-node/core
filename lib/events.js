import _Events from "events";

const GLOBAL_RESERVED_EVENTS = new Set( ["newListener", "removeListener"] );
const RESERVED_EVENTS = new Set( ["subscribe", "unsubscribe"] );

export default class Events extends _Events {
    #pipes = new Map();

    constructor () {
        super();

        this.on( "removeListener", name => {
            if ( GLOBAL_RESERVED_EVENTS.has( name ) || RESERVED_EVENTS.has( name ) || this.listenerCount( name ) ) return;

            this.emit( "unsubscribe", name );
        } );

        this.on( "newListener", name => {
            if ( GLOBAL_RESERVED_EVENTS.has( name ) || RESERVED_EVENTS.has( name ) || this.listenerCount( name ) ) return;

            this.emit( "subscribe", name );
        } );
    }

    // public
    pipe ( events, ignored ) {
        if ( this.#pipes.has( events ) ) return;

        const pipe = this.#pipes
            .set( events, {
                "count": 0,
                "ignored": new Set( ignored || [] ),
                "onRemoveListener": this.#onRemoveListener.bind( this, events ),
                "onNewListener": this.#onNewListener.bind( this, events ),
                "listeners": {},
            } )
            .get( events );

        events.on( "removeListener", pipe.onRemoveListener );

        events.on( "newListener", pipe.onNewListener );
    }

    unpipe ( events ) {
        const pipe = this.#pipes.get( events );

        if ( !pipe ) return;

        for ( const name in pipe.listeners ) {
            this.off( name, pipe.listeners[name] );
        }

        events.off( "removeListener", pipe.onRemoveListener );
        events.off( "newListener", pipe.onNewListener );

        this.#pipes.delete( events );
    }

    // private
    #onNewListener ( events, name ) {
        if ( GLOBAL_RESERVED_EVENTS.has( name ) || events.listenerCount( name ) ) return;

        const pipe = this.#pipes.get( events );

        if ( pipe.ignored.has( name ) ) return;

        pipe.count++;

        pipe.listeners[name] = ( ...args ) => events.emit( name, ...args );

        this.on( name, pipe.listeners[name] );
    }

    #onRemoveListener ( events, name ) {
        if ( GLOBAL_RESERVED_EVENTS.has( name ) || events.listenerCount( name ) ) return;

        const pipe = this.#pipes.get( events );

        if ( pipe.ignored.has( name ) ) return;

        this.off( name, pipe.listeners[name] );

        delete pipe.listeners[name];

        pipe.count--;
    }
}
