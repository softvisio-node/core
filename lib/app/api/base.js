import Events from "#lib/events";

export default class Base extends Events {
    #app;
    #config;
    #components;

    constructor ( app, config, components ) {
        super();

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
        return this._init();
    }

    async run () {
        return this._run();
    }

    // protected
    async _init () {

        // components
        if ( this.#components ) {

            // create components
            for ( const [name, Class] of Object.entries( this.#components ) ) {
                const component = new Class( this );

                Object.defineProperty( this, name, {
                    "configurable": false,
                    "enumerable": false,
                    "writable": false,
                    "value": component,
                } );
            }

            // init components
            for ( const component in this.#components ) {
                const res = await this[component].init();

                if ( !res.ok ) return res;
            }
        }

        return result( 200 );
    }

    async _run () {

        // components
        if ( this.#components ) {

            // run components
            for ( const component in this.#components ) {
                const res = await this[component].run();

                if ( !res.ok ) return res;
            }
        }

        return result( 200 );
    }
}
