import Events from "events";

const FINALIZATION = new FinalizationRegistry( guard => guard.DESTROY() );

class Guard extends Events {
    #isRegistered = true;
    #isDestroyed = false;
    #onDestroy;

    constructor ( onDestroy ) {
        super();

        this.#onDestroy = onDestroy;
    }

    get isRegistered () {
        return this.#isRegistered;
    }

    get isDestroyed () {
        return this.#isDestroyed;
    }

    unregister () {
        if ( this.#isDestroyed || !this.#isRegistered ) return;

        this.#isRegistered = false;

        FINALIZATION.unregister( this );

        this.emit( "unregister" );
    }

    DESTROY () {
        if ( this.#isDestroyed || !this.#isRegistered ) return;

        this.#isDestroyed = true;
        this.#isRegistered = false;

        if ( this.#onDestroy ) {
            this.#onDestroy();

            this.#onDestroy = null;
        }

        this.emit( "destroy" );
    }
}

export default function watch ( object, callback ) {
    const guard = new Guard( callback );

    FINALIZATION.register( object, guard, guard );

    return guard;
}
