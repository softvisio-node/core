export default class Component {
    #components;
    #name;
    #location;
    #required;
    #dependencies;
    #optionalDependencies;
    #config;
    #instance;
    #shutDownLock;

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

    get instance () {
        return this.#instance;
    }

    get aclConfig () {
        return null;
    }

    get notificationsConfig () {
        return null;
    }

    get storageLocationsConfig () {
        return null;
    }

    // public
    async validatePublicConfig ( config ) {
        return this._validatePublicConfig( config );
    }

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
                return result( [ 400, `Component "${ this.name }" is conflicts with the already exists app property` ] );
            }

            this.#instance = await this._install();

            Object.defineProperty( this.app, this.name, {
                "configurable": false,
                "enumerable": false,
                "writable": false,
                "value": this.#instance,
            } );

            // lock shut down
            if ( this._shutDown ) this.#shutDownLock = process.shutdown.lock( this.#name );

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e, { "silent": false } );
        }
    }

    async configureInstance () {
        return this._configureInstance();
    }

    async validateConfig () {
        return this._validateConfig();
    }

    async init () {
        return this._init();
    }

    async start () {
        var res;

        res = await this._start();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async afterAppStarted () {
        var res;

        res = await this._afterAppStarted();
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

    // protected
    async _validatePublicConfig ( config ) {
        return result( 200 );
    }

    async _configure () {
        return result( 200 );
    }

    async _checkEnabled () {

        // optional deps are removed
        return this.isRequired;
    }

    async _install () {
        return true;
    }

    async _configureInstance () {
        return result( 200 );
    }

    _validateConfig () {
        return result( 200 );
    }

    async _init () {
        return result( 200 );
    }

    async _start () {
        return result( 200 );
    }

    async _afterAppStarted () {
        return result( 200 );
    }

    async _checkHealth () {
        return result( 200 );
    }
}
