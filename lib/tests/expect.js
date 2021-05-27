import runner from "#lib/tests/runner";

class Expect {
    #value;

    constructor ( value ) {
        this.#value = value;
    }

    // public
    toBe ( value ) {
        const pass = this.#value === value;

        this.#setResult( "toBe", pass, value );
    }

    toBeDefined () {
        const pass = this.#value !== undefined;

        this.#setResult( "toBeDefined", pass );
    }

    toBeFalsy () {
        const pass = !this.#value;

        this.#setResult( "toBeFalsy", pass );
    }

    toBeInstanceOf ( value ) {
        const pass = this.#value instanceof value;

        this.#setResult( "toBeInstanceOf", pass, value );
    }

    toBeNull () {
        const pass = this.#value === null;

        this.#setResult( "toBeNull", pass );
    }

    toBeTruthy () {
        const pass = !!this.#value;

        this.#setResult( "toBeTruthy", pass );
    }

    toBeUndefined () {
        const pass = this.#value === undefined;

        this.#setResult( "toBeUndefined", pass );
    }

    toBeNaN () {
        const pass = Number.isNaN( this.#value );

        this.#setResult( "toBeNaN", pass );
    }

    // XXX
    toStrictEqual ( value ) {
        const pass = value === this.#value;

        this.#setResult( "toStrinctEqual", pass );
    }

    // private
    #setResult ( name, pass, value ) {
        var res;

        if ( pass ) {
            res = result( 200 );
        }
        else {
            res = result( 500, {
                "message": name,
                "stack": new Error().stack
                    .split( "\n" )
                    .slice( 3 )
                    .map( line => line.trim() )
                    .join( "\n" ),
            } );
        }

        runner.addTestResult( res );
    }
}

export default function expect ( value ) {
    return new Expect( value );
}

global.expect = expect;
