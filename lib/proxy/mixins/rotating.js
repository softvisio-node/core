module.exports = Super =>
    class extends ( Super || Object ) {
        #persistent;
        #timeout;
        #lastRotated;

        constructor ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            super( url, options );

            this.persistent = options.persistent ?? url.searchParams.get( "persistent" ) ?? false;

            this.timeout = options.timeout ?? url.searchParams.get( "timeout" ) ?? 0;
        }

        get url () {
            const url = super.url;

            if ( this.persistent ) url.searchParams.set( "persistent", this.persistent );

            if ( this.timeout ) url.searchParams.set( "timeout", this.timeout );

            return url;
        }

        get persistent () {
            return this.#persistent;
        }

        set persistent ( value ) {
            if ( value === true || value === "true" || value === 1 ) value = true;
            else value = false;

            var updated = this.#persistent !== value;

            this.#persistent = value;

            if ( updated ) this._updated();
        }

        get timeout () {
            return this.#timeout;
        }

        set timeout ( value ) {
            const updated = this.#timeout !== value;

            this.#timeout = parseInt( value );

            if ( updated ) this._updated();
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

        async getNextProxy ( options = {} ) {
            this.#lastRotated = new Date();

            if ( super.getNextProxy ) super.getNextProxy();
        }
    };
