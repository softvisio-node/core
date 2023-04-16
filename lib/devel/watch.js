import Events from "events";

const DESTROY_CALLBACKS = {},
    FINALIZATION = new FinalizationRegistry( id => DESTROY_CALLBACKS[id]?.() );

class DestroyWatcher {
    #id;
    #isRegistered = true;
    #isDestroyed = false;
    #onDestroy;
    #events = new Events();

    constructor ( id, onDestroy ) {
        this.#id = id;
        this.#onDestroy = onDestroy;

        DESTROY_CALLBACKS[id] = this.#destroy.bind( this );
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

        this.#onDestroy?.();

        this.#events.emit( "destroy" );

        this.#cleanup();
    }

    #cleanup () {
        delete DESTROY_CALLBACKS[this.#id];

        this.#onDestroy = null;

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

export default function watch ( object, callback ) {
    const id = {};

    const guard = new DestroyWatcher( id, callback );

    FINALIZATION.register( object, id, id );

    return guard;
}
