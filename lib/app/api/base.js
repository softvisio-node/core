import Events from "#lib/events";

export default class Base extends Events {
    #app;
    #config;
    #components;

    constructor ( app, config, components ) {
        super();

        // frontend component is disabled
        if ( !config.frontend.enabled ) {
            components = { ...components };

            delete components.frontend;
        }

        this.#app = app;
        this.#config = config;
        this.#components = components;
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get isApi () {
        return false;
    }

    get isRpc () {
        return false;
    }

    get httpServer () {
        throw Error( `HTTP server is not defined` );
    }

    // public
    async init () {
        var res;

        // create components
        if ( this.#components ) {
            for ( const [name, Class] of Object.entries( this.#components ) ) {
                const component = new Class( this );

                Object.defineProperty( this, name, {
                    "configurable": false,
                    "enumerable": false,
                    "writable": false,
                    "value": component,
                } );
            }
        }

        // init api
        res = await this._init();
        if ( !res.ok ) return res;

        // init components
        if ( this.#components ) {
            for ( const component in this.#components ) {
                res = await this[component].init();

                if ( !res.ok ) return res;
            }
        }

        // posr-init components
        if ( this.#components ) {
            for ( const component in this.#components ) {
                res = await this[component].postInit();

                if ( !res.ok ) return res;
            }
        }

        // post-init api
        res = await this._postInit();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async run () {
        var res;

        // run components
        if ( this.#components ) {

            // run components
            for ( const component in this.#components ) {
                res = await this[component].run();
                if ( !res.ok ) return res;
            }
        }

        // run api
        res = await this._run();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _postInit () {
        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }
}
