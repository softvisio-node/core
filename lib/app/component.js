export default class Component {
    #components;
    #name;
    #location;
    #required;
    #dependencies;
    #optionalDependencies;
    #config;

    #isConfigured;
    #isInstalled;
    #isInitialized;
    #isStarted = false;
    #shutDownLock;

    #value;

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

    get isConfigured () {
        return this.#isConfigured;
    }

    // public
    async configure () {
        if ( this.#isConfigured ) return result( [400, `Component "${this.name}" is already configured`] );
        this.#isConfigured = true;

        return this._configure();
    }

    async checkEnabled () {
        return this._checkEnabled();
    }

    async install () {
        if ( this.#isInstalled ) return result( [400, `Component "${this.name}" is already installed`] );
        this.#isInstalled = true;

        if ( !this.#isConfigured ) {
            const res = await this.configure();
            if ( !res.ok ) return res;
        }

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

    async init () {
        if ( this.#isInitialized ) return result( [400, `Component "${this.name}" is already initialized`] );
        this.#isInitialized = true;

        if ( !this.#isInstalled ) {
            const res = await this.install();
            if ( !res.ok ) return res;
        }

        return this._init();
    }

    async run () {
        var res;

        if ( this.#isStarted ) return result( [400, `Component "${this.name}" is already started`] );
        this.#isStarted = true;

        if ( !this.#isInitialized ) {
            res = await this.init();
            if ( !res.ok ) return res;
        }

        if ( !this.#isInstalled ) {
            res = await this.install();
            if ( !res.ok ) return res;
        }

        res = await this._run();
        if ( !res.ok ) return res;

        this.#shutDownLock = process.shutdown.lock( this.#name );

        return result( 200 );
    }

    async shutDown () {
        if ( !this.#isStarted ) return;

        await this._shutDown();

        this.#isStarted = false;

        this.#shutDownLock?.done();
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

    async _init () {
        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }

    async _shutDown () {}
}
