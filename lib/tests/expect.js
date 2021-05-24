import runner from "#lib/tests/runner";

class Expect {
    #value;

    constructor ( value ) {
        this.#value = value;
    }

    // public
    toBe ( value ) {
        const pass = this.#value === value;

        this.#setResult( "toBe", value, pass );
    }

    // private
    #setResult ( name, value, pass ) {
        var res;

        if ( pass ) {
            res = result( 200, {
                name,
                "expected": this.#value,
                value,
            } );
        }
        else {
            res = result( 500, {
                name,
                "expected": this.#value,
                value,
            } );
        }

        runner.addTestResult( res );
    }
}

export default function expect ( value ) {
    return new Expect( value );
}
