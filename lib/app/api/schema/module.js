import { readConfig } from "#lib/config";
import Method from "./method.js";
import url from "node:url";
import mixins from "#lib/mixins";
import Base from "#lib/app/api/schema/base";
import { schemaValidator } from "./validator.js";
import { isKebabCase } from "#lib/utils/naming-conventions";

export default class {
    #schema;
    #id;
    #name;
    #version;
    #locations = [];
    #title;
    #description;
    #roles = ["*"];
    #emits = new Set();
    #methods = {};
    #object;

    constructor ( schema, id ) {
        this.#schema = schema;
        this.#id = id;
        this.#version = id.substring( 0, id.indexOf( "/" ) );
        this.#name = id.substring( id.indexOf( "/" ) + 1 );
    }

    // properties
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

    get roles () {
        return this.#roles;
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

    // public
    addLocation ( location ) {
        this.#locations.unshift( location );

        const config = readConfig( `${location}/${this.id}.yaml` );

        // validate spec
        if ( !schemaValidator.validate( "module", config ) ) return result( [500, `Schema error in module "${this.id}":\n${schemaValidator.errors}`] );

        if ( config.title ) this.#title = config.title;
        if ( config.description ) this.#description = config.description;
        if ( config.roles ) this.#roles = config.roles;

        // process methods
        for ( const [name, spec] of Object.entries( config.methods ) ) {

            // check, that method name is in the kebab-case
            if ( !isKebabCase( name ) ) return result( [500, `API method "${name}" must be in the kebab-case`] );

            this.#methods[name] ??= new Method( this, name );

            const res = this.#methods[name].setSpec( spec );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async loadApi ( api ) {
        var Super = [];

        for ( const location of this.#locations ) {
            const mixin = await import( url.pathToFileURL( `${location}/${this.id}.js` ) );

            Super.push( mixin.default );
        }

        Super.push( Base );

        this.#object = new ( class extends mixins( ...Super ) {} )( api );

        return result( 200 );
    }
}
