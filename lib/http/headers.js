import http from "node:http";

// const SINGLE = new Set( ["age", "authorization", "content-length", "content-type", "etag", "expires", "from", "host", "if-modified-since", "if-unmodified-since", "last-modified", "location", "max-forwards", "proxy-authorization", "referer", "retry-after", "server", "or user-agent"] );

export default class Headers {
    #headers;

    constructor ( headers ) {
        this.#headers = headers || {};
    }

    // public
    append ( name, value ) {
        name = name.toLowerCase();
        http.validateHeaderName( name );

        value = String( value );
        http.validateHeaderValue( name, value );

        if ( !( name in this.#headers ) ) {
            this.#headers[name] = value;
        }
        else if ( Array.isArray( this.#headers[name] ) ) {
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

    *keys () {
        for ( const name of Object.keys( this.#headers ) ) {
            yield name;
        }
    }

    set ( name, value ) {
        name = name.toLowerCase();
        http.validateHeaderName( name );

        value = String( value );
        http.validateHeaderValue( name, value );

        this.#headers[name] = value;
    }

    // XXX
    toString () {
        var string = "";

        for ( const [key, value] of Object.entries( this.#headers ) ) {
            if ( Array.isArray( value ) ) {
                string += value.map( val => `${key}:${val}\n` ).join( "" );
            }
            else {
                string += `${key}:${value}\n`;
            }
        }

        return string;
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
