import Events from "events";

const DESTROY_CALLBACKS = new Map(),
    FINALIZATION = new FinalizationRegistry( id => DESTROY_CALLBACKS.get( id )?.() );

class DestroyWatcher {
    #id;
    #isRegistered = true;
    #isDestroyed = false;
    #events = new Events();

    constructor ( id ) {
        this.#id = id;

        DESTROY_CALLBACKS.set( id, this.#destroy.bind( this ) );
    }

    // properties
    get isRegistered () {
        return this.#isRegistered;
    }

    get isDestroyed () {
        return this.#isDestroyed;
    }

    // public
    unregister () {
        if ( this.#isDestroyed || !this.#isRegistered ) return;

        this.#isRegistered = false;

        FINALIZATION.unregister( this.#id );

        this.#events.emit( "unregister" );

        this.#cleanup();
    }

    on ( name, listener ) {
        this.#listen( "on", name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#listen( "once", name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#events.off( name, listener );

        return this;
    }

    // private
    #destroy () {
        this.#isDestroyed = true;
        this.#isRegistered = false;

        this.#events.emit( "destroy" );

        this.#cleanup();
    }

    #cleanup () {
        DESTROY_CALLBACKS.delete( this.#id );

        this.#events.removeAllListeners( "unregister" );
        this.#events.removeAllListeners( "destroy" );
    }

    #listen ( type, name, listener ) {
        if ( name === "unregister" ) {
            if ( this.#isRegistered ) {
                this.#events.once( name, listener );
            }
            else if ( !this.#isDestroyed ) {
                listener();
            }
        }
        else if ( name === "destroy" ) {
            if ( this.#isDestroyed ) {
                listener();
            }
            else if ( this.#isRegistered ) {
                this.#events.once( name, listener );
            }
        }
        else {
            this.#events[type]( name, listener );
        }
    }
}

export default function watch ( object ) {
    const id = {};

    const guard = new DestroyWatcher( id );

    FINALIZATION.register( object, id, id );

    return guard;
}
