import Test from "#lib/tests/test";
import runner from "#lib/tests/runner";

class Group extends Test {
    #module;
    #test;

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

    get module () {
        return this.#module;
    }

    set module ( value ) {
        this.#module = value;
    }

    // public
    // XXX
    run () {
        const res = this.#test();

        if ( res instanceof Promise ) throw `Describe callback must be synchronous`;
    }
}

export default function describe ( name, test ) {
    runner.addTest( new Group( name, test ) );
}

global.describe = describe;

Object.defineProperty( describe, "skip", {
    value ( name, test ) {
        runner.addTest( new Group( name, test, { "skip": true } ) );
    },
} );
