import fs from "node:fs";
import { readConfig } from "#lib/config";
import Ajv from "#lib/ajv";

export default class Component {
    #components;
    #name;
    #location;
    #dependencies;
    #config;

    #isConfigured;
    #isEnabled;
    #isInstalled;
    #isInitialized;
    #isStarted = false;
    #shutDownLock;

    #value;

    constructor ( { components, name, location, dependencies, config } ) {
        this.#components = components;
        this.#name = name;
        this.#location = location;
        this.#dependencies = dependencies || [];
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

    get dependencies () {
        return this.#dependencies;
    }

    get app () {
        return this.#components?.app;
    }

    get config () {
        return this.#config;
    }

    get isEnabled () {
        return this.#isEnabled;
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

        const res = await this._configure();

        if ( !res.ok ) return res;

        this.#isEnabled = res.data === false ? false : true;

        // component is disabled
        if ( !this.#isEnabled ) return res;

        const envSchemaPath = this.location + "/schemas/env.schema.yaml",
            configSchemaPath = this.location + "/schemas/config.schema.yaml";

        // validate env
        if ( fs.existsSync( envSchemaPath ) ) {
            const validate = new Ajv().compile( readConfig( envSchemaPath ) );

            if ( !validate( process.env ) ) {
                return result( [400, `Component "${this.name}" env is not valid:\n` + validate.errors] );
            }
        }

        // validate config
        if ( fs.existsSync( configSchemaPath ) ) {
            const validate = new Ajv().compile( readConfig( configSchemaPath ) );

            if ( !validate( this.#config ) ) {
                return result( [400, `Component "${this.name}" config is not valid:\n` + validate.errors] );
            }
        }

        return result( 200 );
    }

    async install () {
        if ( this.#isInstalled ) return result( [400, `Component "${this.name}" is already installed`] );
        this.#isInstalled = true;

        if ( !this.#isConfigured ) {
            const res = await this.configure();
            if ( !res.ok ) return res;
        }

        // component is disabled
        if ( !this.#isEnabled ) return result( 200 );

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

        // component is disabled
        if ( !this.#isEnabled ) return result( 200 );

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

        // component is disabled
        if ( !this.#isEnabled ) return result( 200 );

        res = await this._run();
        if ( !res.ok ) return res;

        this.#shutDownLock = process.shutdown.lock( this.#name );

        return result( 200 );
    }

    async shutDown () {

        // component is disabled
        if ( !this.#isEnabled ) return;

        if ( !this.#isStarted ) return;

        await this._shutDown();

        this.#isStarted = false;

        this.#shutDownLock.done();
    }

    // protected
    async _configure () {
        return result( 200, true );
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
