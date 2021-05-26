import Test from "#lib/tests/test";
import runner from "#lib/tests/runner";

class Group extends Test {
    #test;
    #tests = [];

    constructor ( name, test, options = {} ) {
        super( name, options );

        this.#test = test;
    }

    get isGroup () {
        return true;
    }

    get type () {
        return "group";
    }

    // public
    load () {
        const res = this.#test();

        if ( res instanceof Promise ) throw `Describe callback must be synchronous`;
    }

    addTest ( test ) {
        if ( test.isGroup ) throw `Nested "describe" statements are not supported`;

        this.#tests.push( test );
    }

    // XXX
    async run ( options ) {}
}

export default function describe ( name, test ) {
    runner.addTest( new Group( name, test ) );
}

global.describe = describe;

Object.defineProperty( describe, "skip", {
    value ( name, test ) {
        describe( name, test, { "skip": true } );
    },
} );
