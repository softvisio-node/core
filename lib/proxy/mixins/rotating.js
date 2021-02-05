const { mixin } = require( "../../mixins" );

module.exports = mixin( Super =>
    class extends Super {
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
                this._clearToString();

                if ( value === true || value === "true" || value === 1 ) this.#persistent = true;
                else this.#persistent = false;
            }

            get timeout () {
                return this.#timeout;
            }

            set timeout ( value ) {
                this._clearToString();

                this.#timeout = parseInt( value );
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
    } );
