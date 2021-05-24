import runner from "#lib/tests/runner";

class Test {
    #name;
    #test;
    #timeout;
    #skip;

    #ok;
    #results = [];

    constructor ( name, test, timeout, options = {} ) {
        this.#name = name;
        this.#test = test;
        this.#timeout = timeout;

        this.#skip = !!options.skip;
    }

    get isTest () {
        return true;
    }

    get type () {
        return "test";
    }

    get name () {
        return this.#name;
    }

    get skip () {
        return this.#skip;
    }

    get ok () {
        return this.#ok;
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

        if ( !res.ok ) this.#ok = false;
        else if ( this.#ok == null ) this.#ok = true;
    }
}

export default function test ( name, test, timeout ) {
    runner.add( new Test( name, test, timeout ) );
}

global.test = test;

Object.defineProperty( test, "skip", {
    value ( name, test, timeout ) {
        runner.add( new Test( name, test, timeout, { "skip": true } ) );
    },
} );
