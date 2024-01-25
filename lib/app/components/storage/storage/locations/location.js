import Interval from "#lib/interval";

export default class Location {
    #locations;
    #location;
    #private;
    #encrypt;
    #cacheControl;
    #maxAge;
    #inactiveMaxAge;

    constructor ( locations, location, parentLocation, { "private": isPrivate, encrypt, cacheControl, maxAge, inactiveMaxAge } = {} ) {
        this.#locations = locations;
        this.#location = location;

        // private
        if ( isPrivate == null ) {
            if ( parentLocation ) {
                this.#private = parentLocation.isPrivate;
            }
            else {
                this.#private = true;
            }
        }
        else {
            this.#private = !!isPrivate;
        }

        // encrypt
        if ( encrypt == null ) {
            if ( parentLocation ) {
                this.#encrypt = parentLocation.encrypt;
            }
            else {
                this.#encrypt = false;
            }
        }
        else {
            this.#encrypt = !!encrypt;
        }

        // cache control
        if ( cacheControl === undefined ) {
            this.#cacheControl = parentLocation?.cacheControl ?? null;
        }
        else {
            this.#cacheControl = cacheControl;
        }

        // max age
        this.#maxAge = maxAge ?? parentLocation?.maxAge;

        if ( this.#maxAge ) {
            this.#maxAge = Interval.new( this.#maxAge );
        }

        // inactive max age
        this.#inactiveMaxAge = inactiveMaxAge ?? parentLocation?.inactiveMaxAge;

        if ( this.#inactiveMaxAge ) {
            this.#inactiveMaxAge = Interval.new( this.#inactiveMaxAge );
        }
    }

    // properties
    get location () {
        return this.#location;
    }

    get isPrivate () {
        return this.#private;
    }

    get encrypt () {
        return this.#encrypt;
    }

    get cacheControl () {
        return this.#cacheControl;
    }

    get maxAge () {
        return this.#maxAge;
    }

    get inactiveMaxAge () {
        return this.#inactiveMaxAge;
    }
}
