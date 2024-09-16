import Interval from "#lib/interval";

export default class Location {
    #locations;
    #location;
    #imageLocation;
    #bucket;
    #private;
    #encrypt;
    #deduplicate;
    #cacheControl;
    #maxAge;
    #inactiveMaxAge;

    constructor ( locations, location, parentLocation, { "private": isPrivate, encrypt, deduplicate, cacheControl, maxAge, inactiveMaxAge } = {} ) {
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
            this.#encrypt = encrypt;
        }

        // deduplicate
        if ( deduplicate == null ) {
            if ( parentLocation ) {
                this.#deduplicate = parentLocation.deduplicate;

                if ( this.#deduplicate ) {
                    this.#imageLocation = parentLocation.imageLocation;
                }
            }
            else {
                this.#deduplicate = false;
            }
        }
        else {
            this.#deduplicate = deduplicate;
        }

        // image location
        this.#imageLocation ||= this.#location;

        this.#bucket = this.#locations.storage.buckets.getBucket( this.#imageLocation );

        // cache control
        if ( cacheControl === undefined ) {
            this.#cacheControl = parentLocation?.cacheControl ?? null;
        }
        else {
            this.#cacheControl = cacheControl;
        }

        // max age
        if ( maxAge === undefined ) {
            this.#maxAge = parentLocation?.maxAge ?? null;
        }
        else {
            this.#maxAge = maxAge;
        }

        if ( this.#maxAge ) {
            this.#maxAge = Interval.new( this.#maxAge );
        }

        // inactive max age
        if ( inactiveMaxAge === undefined ) {
            this.#inactiveMaxAge = parentLocation?.inactiveMaxAge ?? null;
        }
        else {
            this.#inactiveMaxAge = inactiveMaxAge;
        }

        if ( this.#inactiveMaxAge ) {
            this.#inactiveMaxAge = Interval.new( this.#inactiveMaxAge );
        }
    }

    // properties
    get location () {
        return this.#location;
    }

    get imageLocation () {
        return this.#imageLocation;
    }

    get bucket () {
        return this.#bucket;
    }

    get isPrivate () {
        return this.#private;
    }

    get encrypt () {
        return this.#encrypt;
    }

    get deduplicate () {
        return this.#deduplicate;
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

    // public
    createImagePath ( filePath, hash, encrypt ) {
        if ( this.deduplicate ) {
            var imagePath = this.imageLocation + hash;

            if ( encrypt ) imagePath += "-encrypted";

            return imagePath;
        }
        else {
            return filePath;
        }
    }
}
