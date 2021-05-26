import Test from "#lib/tests/test";
import runner from "#lib/tests/runner";

class Group extends Test {
    #callback;
    #tests = [];

    constructor ( name, callback, options = {} ) {
        super( name, options );

        this.#callback = callback;
    }

    get isGroup () {
        return true;
    }

    get type () {
        return "group";
    }

    // public
    load () {
        const res = this.#callback();

        this.#callback = null;

        if ( res instanceof Promise ) throw `Describe callback must be synchronous`;
    }

    addTest ( test ) {
        if ( test.isGroup ) throw `Nested "describe" statements are not supported`;

        this.#tests.push( test );
    }

    // XXX filter by name
    async run ( options ) {}
}

export default function describe ( name, callback ) {
    runner.addTest( new Group( name, callback ) );
}

global.describe = describe;

Object.defineProperty( describe, "skip", {
    value ( name, callback ) {
        describe( name, callback, { "skip": true } );
    },
} );
