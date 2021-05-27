import runner from "#lib/tests/runner";

class Expect {
    #received;

    constructor ( received ) {
        this.#received = received;
    }

    // public
    toBe ( value ) {
        const name = "toBe",
            description = "Object.is( value )";

        const pass = this.#received === value;

        this.#composeResultExpected( pass, name, description, value );
    }

    toBeDefined () {
        const name = "toBeDefined",
            description = "value !== undefined";

        const pass = this.#received !== undefined;

        this.#composeResultReceived( pass, name, description );
    }

    toBeFalsy () {
        const name = "toBeFalsy",
            description = "!value";

        const pass = !this.#received;

        this.#composeResultReceived( pass, name, description );
    }

    toBeInstanceOf ( value ) {
        const name = "toBeInstanceOf",
            description = "instanceof value";

        const pass = this.#received instanceof value;

        this.#composeResultReceived( pass, name, description );
    }

    toBeNull () {
        const name = "toBeNull",
            description = "value === null";

        const pass = this.#received === null;

        this.#composeResultReceived( pass, name, description );
    }

    toBeTruthy () {
        const name = "toBeTruthy",
            description = "!!value";

        const pass = !!this.#received;

        this.#composeResultReceived( pass, name, description );
    }

    toBeUndefined () {
        const name = "toBeUndefined",
            description = "value === undefined";

        const pass = this.#received === undefined;

        this.#composeResultReceived( pass, name, description );
    }

    toBeNaN () {
        const name = "toBeNaN",
            description = "Number.isNaN( value )";

        const pass = Number.isNaN( this.#received );

        this.#composeResultReceived( pass, name, description );
    }

    // XXX
    toStrictEqual ( value ) {
        const pass = value === this.#received;

        this.#setResult( "toStrinctEqual", pass );
    }

    // private
    #composeResultExpected ( pass, name, description, value ) {
        var message;

        if ( !pass ) {
            message = `expect(received).${name}(expected) // ${description}

Expected: ${this.#received}
Received: ${value}`;
        }

        this.#setResult( pass, message );
    }

    #composeResultReceived ( pass, name, description ) {
        var message;

        if ( !pass ) {
            message = `expect(received).${name}() // ${description}

Received: ${this.#received}`;
        }

        this.#setResult( pass, message );
    }

    #setResult ( pass, message ) {
        var res;

        if ( pass ) {
            res = result( 200 );
        }
        else {
            res = result( 500, {
                message,
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
