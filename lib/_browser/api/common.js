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

    async callCached ( key, method, ...args ) {
        var maxAge;

        if ( Array.isArray( key ) ) [key, maxAge] = key;

        var res;

        if ( key ) {
            key += "/" + method;

            res = this.cache.get( key );

            if ( res ) return res;
        }

        res = await this.call( method, ...args );

        if ( key && res.ok ) this.cache.set( key, res, maxAge );

        return res;
    }

    upload ( method, file, ...args ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        return new this.Upload( this, method, file, args );
    }
}
