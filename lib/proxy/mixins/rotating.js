module.exports = Super =>
    class extends ( Super || Object ) {
        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.rotateRandom = options.rotateRandom ?? url.searchParams.get( "rotateRandom" );
            this.rotateTimeout = options.rotateTimeout ?? url.searchParams.get( "rotateTimeout" );
            this.rotateRequests = options.rotateRequests ?? url.searchParams.get( "rotateRequests" );
        }

        get url () {
            const url = super.url;

            if ( this.rotateRequests != null ) url.searchParams.set( "rotateRequests", this.rotateRequests );
            if ( this.rotateTimeout != null ) url.searchParams.set( "rotateTimeout", this.rotateTimeout );
            if ( this.rotateRandom != null ) url.searchParams.set( "rotateRandom", this.rotateRandom );

            return url;
        }

        // rotateRequests
        get rotateRequests () {
            return this._options.rotateRequests;
        }

        set rotateRequests ( value ) {
            this._set( "rotateRequests", this.#parseRotateRequests( value ) );
        }

        #parseRotateRequests ( value ) {
            value = parseInt( value );

            // invalid value
            if ( Number.isNaN( value ) || value < 0 ) return null;

            return value;
        }

        // rotateTimeout
        get rotateTimeout () {
            return this._options.rotateTimeout;
        }

        set rotateTimeout ( value ) {
            this._set( "rotateTimeout", this.#parseRotateTimeout( value ) );
        }

        #parseRotateTimeout ( value ) {
            value = parseInt( value );

            // invalid value
            if ( Number.isNaN( value ) || value < 0 ) return null;

            return value;
        }

        // rotateRandom
        get rotateRandom () {
            return this._options.rotateRandom;
        }

        set rotateRandom ( value ) {
            this._set( "rotateRandom", this.#parseRotateRandom( value ) );
        }

        #parseRotateRandom ( value ) {
            if ( value === "true" || value === true ) return true;
            else if ( value === "false" || value === false ) return false;
            else return null;
        }

        // protected
        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            var value;

            value = this.#parseRotateRequests( options.rotateRequests );
            if ( value != null ) _options.rotateRequests = value;

            value = this.#parseRotateTimeout( options.rotateTimeout );
            if ( value != null ) _options.rotateTimeout = value;

            value = this.#parseRotateRandom( options.rotateRandom );
            if ( value != null ) _options.rotateRandom = value;

            return _options;
        }
    };
