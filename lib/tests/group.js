import runner from "#lib/tests/runner";

class Group {
    #module;
    #name;
    #test;
    #skip;

    constructor ( name, test, options = {} ) {
        this.#name = name;
        this.#test = test;

        this.#skip = !!options.skip;
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

    get name () {
        return this.#name;
    }

    get skip () {
        return this.#skip;
    }

    // public
    // XXX
    run () {
        const res = this.#test();

        if ( res instanceof Promise ) throw `Describe callback must be synchronous`;
    }
}

export default function describe ( name, test ) {
    runner.add( new Group( name, test ) );
}

global.describe = describe;

Object.defineProperty( describe, "skip", {
    value ( name, test ) {
        runner.add( new Group( name, test, { "skip": true } ) );
    },
} );
