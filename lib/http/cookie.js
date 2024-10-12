import util from "node:util";

export default class Cookie {
    #name;
    #value;
    #expires;
    #maxAge;

    #isSession = true;
    #isExpired = false;
    #expirationTimestamp;

    // XXX decode name / value
    // XXX name: 0 - 31, 127, \s, \t, ( ) < > @ , ; : \ " / [ ] ? = { }
    // XXX value: 0 - 31, 127, \s, \t, " , ; \
    constructor ( name, value, { maxAge, expires, url } = {} ) {
        this.#name = name;
        this.#value = value;

        // max age
        if ( maxAge != null ) {
            maxAge = +maxAge;

            if ( Number.isInteger( maxAge ) ) {
                this.#isSession = false;
                this.#maxAge = maxAge;
                this.#expirationTimestamp = Date.now() + maxAge * 1000;
            }
        }

        if ( expires != null && this.#maxAge != null ) {
            expires = new Date( expires );

            if ( Number.isFinite( expires.getTime() ) ) {
                this.#isSession = false;
                this.#expires = expires;
                this.#expirationTimestamp = expires.getTime();
            }
        }
    }

    // static
    static new ( options ) {
        if ( options instanceof this ) {
            return options;
        }
        else {
            return new this( options );
        }
    }

    // properties
    get name () {
        return this.#name;
    }

    get value () {
        return this.#value;
    }

    get maxAge () {
        return this.#maxAge;
    }

    get expires () {
        return this.#expires;
    }

    get isSession () {
        return this.#isSession;
    }

    get isExpired () {
        if ( this.#isExpired == null ) {
            if ( !this.#expirationTimestamp ) {
                this.#isExpired = false;
            }
            else if ( this.#expirationTimestamp <= Date.now() ) {
                this.#isExpired = true;
            }
            else {
                return false;
            }
        }

        return this.#isExpired;
    }

    get expirationTimestamp () {
        return this.#expirationTimestamp;
    }

    // public
    toString () {
        return JSON.stringify( this.toJSON(), null, 4 );
    }

    // XXX
    toJSON () {
        return {
            "name": this.#name,
            "value": this.#value,
            "maxAge": this.#maxAge,
            "expires": this.#expires,
        };
    }

    toCookieHeader () {}

    toSetCookieHeader () {}

    [ util.inspect.custom ] ( depth, options ) {
        return this.toString();
    }
}
