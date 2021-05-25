import "#index";

import Events from "events";

export { default as runner } from "#lib/tests/runner";
export { default as describe } from "#lib/tests/group";
export { default as test } from "#lib/tests/test";
export { default as expect } from "#lib/tests/expect";
export { default as bench } from "#lib/tests/benchmark";

const FINALIZATION = new FinalizationRegistry( guard => guard.destroy() );

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

    destroy () {
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

export function watch ( object, callback ) {
    const guard = new Guard( callback );

    FINALIZATION.register( object, guard, guard );

    return guard;
}
