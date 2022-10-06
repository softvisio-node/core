import fs from "node:fs";
import { readConfig } from "#lib/config";
import Ajv from "#lib/ajv";

export default class Component {
    #components;
    #name;
    #location;
    #config;

    #isConfigured;
    #isInstalled;
    #isInitialized;
    #isStarted;

    #value;

    constructor ( components, name, location, config ) {
        this.#components = components;
        this.#name = name;
        this.#location = location;
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

    get app () {
        return this.#components?.app;
    }

    get config () {
        return this.#config;
    }

    get value () {
        return this.#value;
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

        try {
            const value = await this._install();

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

        return this._init();
    }

    async run () {
        if ( this.#isStarted ) return result( [400, `Component "${this.name}" is already started`] );
        this.#isStarted = true;

        return this._run();
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
}
