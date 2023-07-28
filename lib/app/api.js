export default class Api {
    #app;
    #config;
    #components = [];
    #schema;

    constructor ( app, config, components ) {
        this.#app = app;
        this.#config = config;

        // create and configure components
        for ( const [name, Class] of Object.entries( components ) ) {

            // create component instance
            const component = new Class( this );

            // install component
            Object.defineProperty( this, name, {
                "configurable": false,
                "enumerable": false,
                "writable": false,
                "value": component,
            } );

            this.#components.push( component );
        }
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
    async configure ( schema ) {
        this.#schema = schema;

        // configure components
        for ( const component of this.#components ) {
            const res = await component.configure();

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async init () {
        var res;

        // init api
        res = await this._init();
        if ( !res.ok ) return res;

        // init components
        for ( const component of this.#components ) {
            res = await component.init();

            if ( !res.ok ) return res;
        }

        // after-init components
        for ( const component of this.#components ) {
            res = await component.afterInit();

            if ( !res.ok ) return res;
        }

        // post-init api
        res = await this._afterInit();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async start () {
        var res;

        // start components
        for ( const component of this.#components ) {
            res = await component.start();
            if ( !res.ok ) return res;
        }

        // start api
        res = await this._start();
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

    async _afterInit () {
        return result( 200 );
    }

    async _start () {
        return result( 200 );
    }
}
