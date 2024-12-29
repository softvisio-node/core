import fs from "node:fs";
import { readConfig } from "#lib/config";
import { mergeObjects } from "#lib/utils";

export default class Component {
    #components;
    #id;
    #location;
    #required;
    #dependencies;
    #optionalDependencies;
    #config;
    #instance;
    #shutDownLock;

    constructor ( { components, id, location, required, dependencies, optionalDependencies, config } ) {
        this.#components = components;
        this.#id = id;
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

    get id () {
        return this.#id;
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
    applySubConfig () {
        return this._applySubConfig();
    }

    applySubSchema ( schema ) {
        return this._applySubSchema( schema );
    }

    async configure () {
        return this._configure();
    }

    async checkEnabled () {
        return this._checkEnabled();
    }

    async install () {
        try {

            // component id conflict
            if ( this.id in this.app ) {
                return result( [ 400, `Component "${ this.id }" is conflicts with the already exists app property` ] );
            }

            this.#instance = await this._install();

            Object.defineProperty( this.app, this.id, {
                "configurable": false,
                "enumerable": false,
                "writable": false,
                "value": this.#instance,
            } );

            // lock shut down
            if ( this._destroy ) this.#shutDownLock = process.shutdown.lock( this.#id );

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e );
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

        process.stdout.write( "Destroying component: " + this.id + " ... " );

        await this._destroy();

        console.log( "done" );

        this.#shutDownLock?.done();
    }

    async checkHealth () {
        return this._checkHealth();
    }

    // protected
    _applySubConfig () {}

    _applySubSchema ( schema ) {
        return schema;
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

    _mergeSubConfig ( location ) {
        const path = new URL( "sub-config.yaml", location );

        if ( !fs.existsSync( path ) ) return;

        const subConfig = readConfig( path );

        if ( subConfig ) mergeObjects( this.config, subConfig );
    }

    _mergeSubSchema ( schema, location ) {
        const path = new URL( "sub-config.schema.yaml", location );

        if ( !fs.existsSync( path ) ) return schema;

        var subSchema = readConfig( path );

        if ( !subSchema?.length ) return schema;

        subSchema = subSchema.reduce( ( index, schema ) => {
            index[ schema[ "$id" ] ] = schema;

            delete schema[ "$id" ];

            return index;
        }, {} );

        schema = ( schema || [] ).reduce( ( index, schema ) => {
            index[ schema[ "$id" ] ] = schema;

            delete schema[ "$id" ];

            return index;
        }, {} );

        if ( subSchema[ "public-config" ] ) {
            if ( schema[ "public-config" ] ) {
                schema[ "public-config" ] = { "allOf": [ schema[ "public-config" ], subSchema[ "public-config" ] ] };
            }
            else {
                schema[ "public-config" ] = subSchema[ "public-config" ];
            }
        }

        if ( subSchema[ "config" ] ) {
            const required = schema[ "config" ]?.required || [];

            schema[ "config" ] = mergeObjects( schema[ "config" ], subSchema[ "config" ] );

            schema[ "config" ].required ||= [];
            schema[ "config" ].required = [ ...schema[ "config" ].required, ...required ];
        }

        return Object.entries( schema ).map( ( [ id, schema ] ) => {
            return {
                [ "$id" ]: id,
                ...schema,
            };
        } );
    }
}
