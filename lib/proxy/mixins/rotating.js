export default Super =>
    class extends ( Super || class {} ) {

        // rotateRequests
        get rotateRequests () {
            return this._options.rotateRequests;
        }

        set rotateRequests ( value ) {
            this._set( "rotateRequests", this.#parseRotateRequests( value ) );
        }

        #parseRotateRequests ( value ) {
            value = Number.parseInt( value );

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

        // rotateRandom
        get rotateRandom () {
            return this._options.rotateRandom;
        }

        set rotateRandom ( value ) {
            this._set( "rotateRandom", this.#parseRotateRandom( value ) );
        }

        // protected
        _init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super._init ) super._init( url, options );

            this.rotateRandom = options.rotateRandom ?? url.searchParams.get( "rotateRandom" );
            this.rotateTimeout = options.rotateTimeout ?? url.searchParams.get( "rotateTimeout" );
            this.rotateRequests = options.rotateRequests ?? url.searchParams.get( "rotateRequests" );
        }

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

        _buildUrl () {
            const url = super._buildUrl();

            if ( this.rotateRequests != null ) url.searchParams.set( "rotateRequests", this.rotateRequests );
            if ( this.rotateTimeout != null ) url.searchParams.set( "rotateTimeout", this.rotateTimeout );
            if ( this.rotateRandom != null ) url.searchParams.set( "rotateRandom", this.rotateRandom );

            return url;
        }

        // private
        #parseRotateRandom ( value ) {
            if ( value === "true" || value === true ) return true;
            else if ( value === "false" || value === false ) return false;
            else return null;
        }

        #parseRotateTimeout ( value ) {
            value = Number.parseInt( value );

            // invalid value
            if ( Number.isNaN( value ) || value < 0 ) return null;

            return value;
        }
    };
