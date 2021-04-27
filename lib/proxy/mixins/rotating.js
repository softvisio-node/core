module.exports = Super =>
    class extends ( Super || Object ) {
        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.rotate = options.rotate ?? url.searchParams.get( "rotate" ) ?? this.defaultRotate;
            this.rotateRandom = options.rotateRandom ?? url.searchParams.get( "rotateRandom" );
            this.rotateTimeout = options.rotateTimeout ?? url.searchParams.get( "rotateTimeout" );
            this.rotateRequests = options.rotateRequests ?? url.searchParams.get( "rotateRequests" );
        }

        get url () {
            const url = super.url;

            if ( this.rotate !== this.defaultRotate ) url.searchParams.set( "rotate", this.rotate );

            if ( this.rotateRandom ) url.searchParams.set( "rotateRandom", "true" );

            if ( this.rotateTimeout ) url.searchParams.set( "rotateTimeout", this.rotateTimeout );

            if ( this.rotateRequests ) url.searchParams.set( "rotateRequests", this.rotateRequests );

            return url;
        }

        // rotate
        get defaultRotate () {
            return false;
        }

        get rotate () {
            return this._options.rotate;
        }

        set rotate ( value ) {
            this._set( "rotate", this.#parseRotate( value ) );
        }

        #parseRotate ( value ) {
            if ( value === true || value === "true" ) return true;
            else return false;
        }

        // rotateRandom
        get rotateRandom () {
            return this._options.rotateRandom;
        }

        set rotateRandom ( value ) {
            this._set( "rotateRandom", this.#parseRotateRandom( value ) );
        }

        #parseRotateRandom ( value ) {
            if ( value === true || value === "true" ) return true;
            else return false;
        }

        // rotateTimeout
        get rotateTimeout () {
            return this._options.rotateTimeout;
        }

        set rotateTimeout ( value ) {
            this._set( "rotateTimout", this.#parseRotateTimeout( value ) );
        }

        #parseRotateTimeout ( value ) {
            value = parseInt( value );

            if ( Number.isNaN( value ) ) return 0;

            if ( value < 0 ) return 0;

            return value;
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

            if ( Number.isNaN( value ) ) return 0;

            if ( value < 0 ) return 0;

            return value;
        }

        // protected
        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( "rotate" in options ) _options.rotate = this.#parseRotate( options.rotate );
            if ( "rotateRandom" in options ) _options.rotateRandom = this.#parseRotateRandom( options.rotateRandom );
            if ( "rotateTimeout" in options ) _options.rotateTimeout = this.#parseRotateTimeout( options.rotateTimeout );
            if ( "rotateRequests" in options ) _options.rotateRequests = this.#parseRotateRequests( options.rotateRequests );

            return _options;
        }
    };
