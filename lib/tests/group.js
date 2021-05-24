import runner from "#lib/tests/runner";

class Group {
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

    get name () {
        return this.#name;
    }

    get skip () {
        return this.#skip;
    }

    // public
    // XXX
    async run () {}
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
