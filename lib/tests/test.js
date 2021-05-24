import runner from "#lib/tests/runner";

class Test {
    #name;
    #test;
    #isFailed = false;
    #results = [];

    constructor ( name, test ) {
        this.#name = name;
        this.#test = test;
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

export default function test ( name, test ) {
    runner.addTest( new Test( name, test ) );
}
