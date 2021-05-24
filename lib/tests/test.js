import runner from "#lib/tests/runner";

class Test {
    #name;
    #test;
    #timeout;
    #skip;

    #isFailed = false;
    #results = [];

    constructor ( name, test, timeout, options = {} ) {
        this.#name = name;
        this.#test = test;
        this.#timeout = timeout;

        this.#skip = !!options.skip;
    }

    get name () {
        return this.#name;
    }

    get isFailed () {
        return this.#isFailed;
    }

    // XXX
    async run () {
        try {
            await this.#test();
        }
        catch ( e ) {
            console.log( e );
        }
    }

    addResult ( res ) {
        this.#results.push( res );

        if ( !res.ok ) this.#isFailed = true;
    }
}

export default function test ( name, test, timeout ) {
    runner.addTest( new Test( name, test, timeout ) );
}

Object.defineProperty( test, "skip", {
    value ( name, test, timeout ) {
        runner.addTest( new Test( name, test, timeout, { "skip": true } ) );
    },
} );
