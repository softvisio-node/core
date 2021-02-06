module.exports = Super =>
    class extends ( Super || Object ) {
        #persistent;
        #random;
        #timeout;
        #lastRotated;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.persistent = options.persistent ?? url.searchParams.get( "persistent" ) ?? false;

            this.random = options.random ?? url.searchParams.get( "random" ) ?? false;

            this.timeout = options.timeout ?? url.searchParams.get( "timeout" ) ?? 0;
        }

        get url () {
            const url = super.url;

            if ( this.persistent ) url.searchParams.set( "persistent", this.persistent );

            if ( this.random ) url.searchParams.set( "random", this.random );

            if ( this.timeout ) url.searchParams.set( "timeout", this.timeout );

            return url;
        }

        get persistent () {
            return this.#persistent;
        }

        set persistent ( value ) {
            if ( value === true || value === "true" || value === 1 ) value = true;
            else value = false;

            var updated = this.#persistent !== ( value || false );

            if ( !updated ) return;

            this.#persistent = value;

            this._updated();
        }

        get random () {
            return this.#random;
        }

        set random ( value ) {
            if ( value === true || value === "true" || value === 1 ) value = true;
            else value = false;

            var updated = this.#random !== ( value || false );

            if ( !updated ) return;

            this.#random = value;

            this._updated();
        }

        get timeout () {
            return this.#timeout;
        }

        set timeout ( value ) {
            value = parseInt( value || 0 );

            const updated = this.#timeout !== ( value || 0 );

            if ( !updated ) return;

            this.#timeout = value;

            this._updated();
        }

        _needRotate () {
            if ( this.persistent ) return false;

            if ( this.timeout ) {
                if ( !this.#lastRotated ) return false;

                if ( new Date().getTime() - this.#lastRotated >= this.timeout ) return true;

                return false;
            }

            return true;
        }

        _rotated () {
            this.#lastRotated = new Date();
        }
    };
