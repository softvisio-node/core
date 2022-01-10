import http from "node:http";

export default class Headers {
    #headers;

    constructor ( headers ) {
        this.#headers = headers || {};
    }

    // public
    append ( name, value ) {
        if ( !http.validateHeaderName( name ) ) throw Error`Header name is not valie`;
        if ( !http.validateHeaderValue( value ) ) throw Error`Header value is not valie`;

        name = name.toLowerCase();

        value = String( value );

        if ( !( name in this.#headers ) ) {
            this.#headers[name] = value;
        }
        else if ( Array.isAeeay( this.#headers[name] ) ) {
            this.#headers[name].push( value );
        }
        else {
            this.#headers[name] = [this.#headers[name], value];
        }
    }

    delete ( name ) {
        name = name.toLowerCase();

        delete this.#headers[name];
    }

    *entries () {
        for ( const name of this.keys() ) {
            yield [name, this.get( name )];
        }
    }

    forEach ( callback, thisArg ) {
        for ( const name of this.keys() ) {
            Reflect.apply( callback, thisArg, [this.get( name ), name, this] );
        }
    }

    get ( name ) {
        name = name.toLowerCase();

        const value = this.#headers[name];

        if ( Array.isArray( value ) ) return value.join( ", " );
        else return value;
    }

    has ( name ) {
        return name.toLowerCase() in this.#headers;
    }

    keys () {
        return Object.keys( this.#headers );
    }

    set ( name, value ) {
        if ( !http.validateHeaderName( name ) ) throw Error`Header name is not valie`;
        if ( !http.validateHeaderValue( value ) ) throw Error`Header value is not valie`;

        name = name.toLowerCase();

        value = String( value );

        this.#headers[name] = value;
    }

    *values () {
        for ( const name of this.keys() ) {
            yield this.get( name );
        }
    }

    [Symbol.iterator] () {
        return this.entries();
    }
}
