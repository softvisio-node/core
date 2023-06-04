export default class Api {
    #app;
    #config;
    #components;
    #schema;

    constructor ( app, config, components ) {
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

    get schema () {
        return this.#schema;
    }

    // public
    async configure () {
        return result( 200 );
    }

    async init ( schema ) {
        this.#schema = schema;

        var res;

        const components = [];

        // create and configure components
        for ( const [name, Class] of Object.entries( this.#components ) ) {

            // component name conflict
            if ( name in this ) {
                return result( [400, `API component "${name}" is conflicts with the already exists api property`] );
            }

            const component = new Class( this );

            // install component
            Object.defineProperty( this, name, {
                "configurable": false,
                "enumerable": false,
                "writable": false,
                "value": component,
            } );

            components.push( component );
        }

        this.#components = components;

        // init api
        res = await this._init();
        if ( !res.ok ) return res;

        // init components
        for ( const component of this.#components ) {
            res = await component.init();

            if ( !res.ok ) return res;
        }

        // post-init components
        for ( const component of this.#components ) {
            res = await component.postInit();

            if ( !res.ok ) return res;
        }

        // post-init api
        res = await this._postInit();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async run () {
        var res;

        // run components
        for ( const component of this.#components ) {
            res = await component.run();
            if ( !res.ok ) return res;
        }

        // run api
        res = await this._run();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async shutDown () {

        // shuting down components
        for ( const component of this.#components.reverse() ) {
            await component.shutDown();
        }
    }

    on ( name, listener ) {
        this.frontend.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.frontend.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.frontend.off( name, listener );

        return this;
    }

    publish ( ...args ) {
        this.frontend.publish( ...args );

        return this;
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
