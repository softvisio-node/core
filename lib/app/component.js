export default class Component {
    #components;
    #name;
    #location;
    #required;
    #dependencies;
    #optionalDependencies;
    #config;
    #value;
    #shutDownLock;
    #locale;

    constructor ( { components, name, location, required, dependencies, optionalDependencies, config } ) {
        this.#components = components;
        this.#name = name;
        this.#location = location;
        this.#required = required;
        this.#dependencies = dependencies || [];
        this.#optionalDependencies = optionalDependencies || [];
        this.#config = config;
    }

    // properties
    get components () {
        return this.#components;
    }

    get name () {
        return this.#name;
    }

    get location () {
        return this.#location;
    }

    get isRequired () {
        return this.#required;
    }

    get dependencies () {
        return this.#dependencies;
    }

    get optionalDependencies () {
        return this.#optionalDependencies;
    }

    get app () {
        return this.#components?.app;
    }

    get config () {
        return this.#config;
    }

    get value () {
        return this.#value;
    }

    get locale () {
        this.#locale ??= this.app.locales.getComponentLocale( this.name );

        return this.#locale;
    }

    // public
    async configure () {
        return this._configure();
    }

    async checkEnabled () {
        return this._checkEnabled();
    }

    async install () {
        try {

            // component name conflict
            if ( this.name in this.app ) {
                return result( [400, `Component "${this.name}" is conflicts with the already exists app property`] );
            }

            this.#value = await this._install();

            Object.defineProperty( this.app, this.name, {
                "configurable": false,
                "enumerable": false,
                "writable": false,
                "value": this.#value,
            } );

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true } );
        }
    }

    async configureInstance () {
        return this._configureInstance();
    }

    async init () {
        return this._init();
    }

    async start () {
        var res;

        res = await this._start();
        if ( !res.ok ) return res;

        if ( this._shutDown ) this.#shutDownLock = process.shutdown.lock( this.#name );

        return result( 200 );
    }

    async postStart () {
        var res;

        res = await this._postStart();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async shutDown () {
        if ( !this.#shutDownLock || this.#shutDownLock.isDone ) return;

        process.stdout.write( "Shutting down component: " + this.name + " ... " );

        await this._shutDown();

        console.log( "done" );

        this.#shutDownLock?.done();
    }

    async checkHealth () {
        return this._checkHealth();
    }

    async getAcl () {
        return this._getAcl();
    }

    // protected
    async _configure () {
        return result( 200 );
    }

    async _checkEnabled () {
        return true;
    }

    async _install () {
        return true;
    }

    async _configureInstance () {
        return result( 200 );
    }

    async _init () {
        return result( 200 );
    }

    async _start () {
        return result( 200 );
    }

    async _postStart () {
        return result( 200 );
    }

    async _checkHealth () {
        return result( 200 );
    }

    async _getAcl () {
        return this.#config?.acl;
    }
}
