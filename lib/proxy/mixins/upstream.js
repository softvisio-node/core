module.exports = Super =>
    class extends ( Super || Object ) {
        #upstream;

        _updated () {
            super._updated();

            this.#upstream = null;
        }

        async connect ( url ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( !this.#upstream ) this.#upstream = await this.getProxy();

            const proxy = this.#upstream;

            if ( !proxy ) return Promise.reject( "Unable to get proxy" );

            return proxy.connect( url );
        }
    };
