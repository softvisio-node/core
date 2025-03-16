import url from "node:url";
import Base from "#lib/app/api/schema/base";
import { readConfigSync } from "#lib/config";
import mixins from "#lib/mixins";
import Method from "./method.js";
import { schemaValidator } from "./validator.js";

export default class ApiModule {
    #schema;
    #id;
    #name;
    #version;
    #locations = [];
    #title;
    #description;
    #emits = new Set();
    #methods = {};
    #object;
    #aclResolvers = {};

    constructor ( schema, id ) {
        this.#schema = schema;
        this.#id = id;
        this.#version = id.slice( 1, id.indexOf( "/", 1 ) );
        this.#name = id.slice( id.indexOf( "/", 1 ) + 1 );
    }

    // properties
    get api () {
        return this.#schema.api;
    }

    get schema () {
        return this.#schema;
    }

    get id () {
        return this.#id;
    }

    get version () {
        return this.#version;
    }

    get name () {
        return this.#name;
    }

    get title () {
        return this.#title;
    }

    get description () {
        return this.#description;
    }

    get emits () {
        return this.#emits;
    }

    get methods () {
        return this.#methods;
    }

    get object () {
        return this.#object;
    }

    get aclResolvers () {
        return this.#aclResolvers;
    }

    // public
    addLocation ( location ) {
        this.#locations.unshift( location );

        const config = readConfigSync( `${ location }/${ this.id }.yaml` );

        // validate spec
        if ( !schemaValidator.validate( "module", config ) ) return result( [ 500, `Schema error in module "${ this.id }":\n${ schemaValidator.errors }` ] );

        if ( config.title ) this.#title = config.title;
        if ( !this.#title ) return result( [ 400, `API module title is required` ] );

        if ( Reflect.has( config, "description" ) ) this.#description = config.description;
        if ( Reflect.has( config, "emits" ) ) this.#emits = new Set( [ ...this.#emits, ...config.emits ] );

        // acl resolvers
        if ( config.aclResolvers ) {
            for ( const [ aclResolver, query ] of Object.entries( config.aclResolvers ) ) {
                if ( aclResolver in this.#aclResolvers ) return result( [ 500, `ACL resolver "${ aclResolver }" is already defined` ] );

                this.#aclResolvers[ aclResolver ] = query;
            }
        }

        // process methods
        for ( const [ name, methodConfig ] of Object.entries( config.methods ) ) {
            this.#methods[ name ] ??= new Method( this, name );

            const res = this.#methods[ name ].setConfig( methodConfig );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async loadApi ( api ) {
        var Super = [];

        for ( const location of this.#locations ) {
            try {
                const mixin = await import( url.pathToFileURL( `${ location }/${ this.id }.js` ) );

                Super.push( mixin.default );
            }
            catch ( e ) {
                return result.catch( e );
            }
        }

        Super.push( Base );

        this.#object = new ( class extends mixins( ...Super ) {} )( api );

        return result( 200 );
    }

    toJSON () {
        return {
            "title": this.title,
            "description": this.description,
            "methods": this.methods,
        };
    }
}
