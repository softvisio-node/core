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

    // XXX
    async run () {}
}

export default function describe ( name, test ) {
    runner.addGroup( new Group( name, test ) );
}

describe.skip = function ( name, test ) {
    runner.addGroup( new Group( name, test, { "skip": true } ) );
};
