import Context from "#lib/app/api/frontend/context";
import DigitalSize from "#lib/digital-size";
import Interval from "#lib/interval";

export default class Api {
    #app;
    #config;
    #components = [];
    #schema;
    #idleTimeout;
    #maxApiRequestBodySize;

    constructor ( app, config, components ) {
        this.#app = app;
        this.#config = config;

        // create and configure components
        for ( const [ name, Class ] of Object.entries( components ) ) {

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

    get idleTimeout () {
        this.#idleTimeout ??= Interval.new( this.config.frontend.idleTimeout ).toSeconds();

        return this.#idleTimeout;
    }

    get maxApiRequestBodySize () {
        this.#maxApiRequestBodySize ??= DigitalSize.new( this.config.frontend.maxApiRequestBodySize ).bytes;

        return this.#maxApiRequestBodySize;
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

    async destroy () {

        // destroy components
        for ( const component of this.#components.reverse() ) {
            await component.destroy();
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

    async call ( method, ...args ) {
        return this.#call( method, args, false );
    }

    voidCall ( method, ...args ) {
        this.#call( method, args, true );
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

    async #call ( method, args, isVoid ) {
        if ( typeof method === "object" ) {
            var user, telegramBotUser, signal;

            ( { method, args, user, telegramBotUser, signal } = method );
        }

        if ( !Array.isArray( args ) ) args = [];

        // add api version to the method
        if ( !method.startsWith( "/" ) ) method = `/v${ this.config.defaultVersion }/${ method }`;

        const ctx = new Context( this, {
            "token": null,
            user,
            telegramBotUser,
            signal,
            "hostname": null,
            "userAgent": null,
            "remoteAddress": null,
        } );

        if ( isVoid ) {
            ctx.voidCall( method, ...args );
        }
        else {
            return ctx.call( method, ...args );
        }
    }
}
