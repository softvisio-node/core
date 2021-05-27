import runner from "#lib/tests/runner";
import ansi from "#lib/text/ansi";

class Expect {
    #received;
    #not;

    constructor ( received, not ) {
        this.#received = received;
        this.#not = !!not;
    }

    get not () {
        return new Expect( this.#received, !this.#not );
    }

    // public
    toBe ( expected ) {
        const name = "toBe",
            description = "Object.is( value )";

        const pass = this.#check( this.#received === expected );

        this.#composeResultExpected( pass, name, description, expected );
    }

    toBeDefined () {
        const name = "toBeDefined",
            description = "value !== undefined";

        const pass = this.#check( this.#received !== undefined );

        this.#composeResultReceived( pass, name, description );
    }

    toBeFalsy () {
        const name = "toBeFalsy",
            description = "!value";

        const pass = this.#check( !this.#received );

        this.#composeResultReceived( pass, name, description );
    }

    toBeInstanceOf ( expected ) {
        const name = "toBeInstanceOf",
            description = "instanceof value";

        const pass = this.#check( this.#received instanceof expected );

        this.#composeResultExpected( pass, name, description, expected );
    }

    toBeNull () {
        const name = "toBeNull",
            description = "value === null";

        const pass = this.#check( this.#received === null );

        this.#composeResultReceived( pass, name, description );
    }

    toBeTruthy () {
        const name = "toBeTruthy",
            description = "!!value";

        const pass = this.#check( !!this.#received );

        this.#composeResultReceived( pass, name, description );
    }

    toBeUndefined () {
        const name = "toBeUndefined",
            description = "value === undefined";

        const pass = this.#check( this.#received === undefined );

        this.#composeResultReceived( pass, name, description );
    }

    toBeNaN () {
        const name = "toBeNaN",
            description = "Number.isNaN( value )";

        const pass = this.#check( Number.isNaN( this.#received ) );

        this.#composeResultReceived( pass, name, description );
    }

    // XXX
    toStrictEqual ( expected ) {
        const name = "toStrictEqual",
            description = "deep equality";

        const pass = expected === this.#received;

        this.#composeResultExpected( pass, name, description, expected );
    }

    // private
    #check ( pass ) {
        if ( this.#not ) return !pass;
        else return !!pass;
    }

    #composeResultExpected ( pass, name, description, expected ) {
        var message;

        if ( !pass ) {
            message = `expect( ${ansi.brightGreen( "received" )} )${this.#not ? ".not" : ""}.${name}( ${ansi.brightMagenta( "expected" )} )${description ? " // " + description : ""}

Expected: ${ansi.brightMagenta( expected )}
Received: ${ansi.brightGreen( this.#received )}`;
        }

        this.#setResult( pass, message );
    }

    #composeResultReceived ( pass, name, description ) {
        var message;

        if ( !pass ) {
            message = `expect( ${ansi.brightGreen( "received" )} )${this.#not ? ".not" : ""}.${name}()${description ? " // " + description : ""}

Received: ${ansi.brightGreen( this.#received )}`;
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
