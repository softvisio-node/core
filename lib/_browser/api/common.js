import Options from "./options.js";

export default class extends Options {

    // static
    static new ( url, options = {} ) {
        const api = new this();

        api.init( url, options );

        return api;
    }

    // properties
    get api () {
        return this;
    }

    // public
    toString () {
        return this.url;
    }

    toJSON () {
        return this.url;
    }

    async callCached ( method, { key, maxAge }, ...args ) {
        var res;

        if ( key ) {
            key += "/" + method;

            res = this.cache.get( key );

            if ( res ) return res;
        }

        res = await this.call( method, ...args );

        this.cacheResult( res, key, maxAge );

        return res;
    }

    upload ( method, file, ...args ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        return new this.Upload( this, method, file, args );
    }

    cacheResult ( res, key, maxAge ) {

        // cache successful responses
        if ( key && res.ok && !res.meta["cache-control-no-cache"] ) {
            if ( res.meta["cache-control-expires"] ) {
                const _maxAge = Date.parse( res.meta["cache-control-expires"] ) - new Date();

                if ( !isNaN( _maxAge ) ) {
                    if ( maxAge && _maxAge < maxAge ) maxAge = _maxAge;
                    else maxAge = _maxAge;
                }
            }

            if ( res.meta["cache-control-max-age"] ) {
                const _maxAge = res.meta["cache-control-max-age"];

                if ( typeof _maxAge === "number" ) {
                    if ( maxAge && _maxAge < maxAge ) maxAge = _maxAge;
                    else maxAge = _maxAge;
                }
            }

            this.cache.set( key, res, maxAge );
        }
    }
}
