import Events from "events";

const DESTROY_CALLBACKS = {},
    FINALIZATION = new FinalizationRegistry( id => DESTROY_CALLBACKS[id]?.() );

class Guard extends Events {
    #id;
    #isRegistered = true;
    #isDestroyed = false;
    #onDestroy;

    constructor ( id, onDestroy ) {
        super();

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

        this.emit( "unregister" );

        this.#cleanup();
    }

    // private
    #destroy () {
        this.#isDestroyed = true;
        this.#isRegistered = false;

        this.#onDestroy?.();

        this.emit( "destroy" );

        this.#cleanup();
    }

    #cleanup () {
        delete DESTROY_CALLBACKS[this.#id];

        this.#onDestroy = null;

        this.removeAllListeners( "unregister" );
        this.removeAllListeners( "destroy" );
    }
}

export default function watch ( object, callback ) {
    const id = {};

    const guard = new Guard( id, callback );

    FINALIZATION.register( object, id, id );

    return guard;
}
