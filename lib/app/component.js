import fs from "node:fs";
import { readConfig } from "#lib/config";
import Ajv from "#lib/ajv";

export default class Component {
    #components;
    #name;
    #location;
    #config;
    #isOptional;

    #isConfigured;
    #isInstalled;
    #isInitialized;
    #isStarted = false;
    #shutDownLock;

    #value;

    constructor ( components, name, location, config, isOptional ) {
        this.#components = components;
        this.#name = name;
        this.#location = location;
        this.#config = config;
        this.#isOptional = isOptional;
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

    get app () {
        return this.#components?.app;
    }

    get config () {
        return this.#config;
    }

    get isOptional () {
        return this.#isOptional;
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

        try {
            const value = await this._install();

            // required component must install some value
            if ( value == null && !this.#isOptional ) {
                return result( [500, `Required component "${this.name}" must install not null value`] );
            }

            Object.defineProperty( this.app, this.name, {
                "configurable": false,
                "enumerable": false,
                "writable": false,
                value,
            } );

            this.#value = value;

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

        this.#shutDownLock.done();
    }

    // protected
    async _configure () {
        return result( 200 );
    }

    async _install () {
        return;
    }

    async _init () {
        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }

    async _shutDown () {}
}
