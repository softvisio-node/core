import Interval from "#lib/interval";

export default class Location {
    #locations;
    #location;
    #httpLocation;
    #private;
    #encrypt;
    #cacheControl;
    #maxAge;
    #inactiveMaxAge;

    constructor ( locations, location, parentLocation, { "private": isPrivate, encrypt, cacheControl, maxAge, inactiveMaxAge } = {} ) {
        this.#locations = locations;
        this.#location = location;

        // XXX
        this.#httpLocation = this.#locations.storage.connfog.location + this.#locations;

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

        this.#cacheControl = cacheControl ?? parentLocation?.cacheControl;

        this.#maxAge = maxAge ?? parentLocation?.maxAge;

        if ( this.#maxAge ) {
            this.#maxAge = Interval.new( this.#maxAge );
        }

        this.#inactiveMaxAge = inactiveMaxAge ?? parentLocation?.inactiveMaxAge;

        if ( this.#inactiveMaxAge ) {
            this.#inactiveMaxAge = Interval.new( this.#inactiveMaxAge );
        }
    }

    // properties
    get location () {
        return this.#location;
    }

    get httpLocation () {
        return this.#httpLocation;
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
