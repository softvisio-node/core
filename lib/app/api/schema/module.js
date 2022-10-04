import { readConfig } from "#lib/config";
import Method from "./method.js";
import url from "node:url";
import mixins from "#lib/mixins";
import Base from "#lib/app/api/schema/base";

export default class {
    #schema;
    #name;
    #version;
    #locations = [];
    #title;
    #description;
    #roles = new Set( ["*"] );
    #emits = new Set();
    #methods = {};
    #object;

    constructor ( schema, name ) {
        this.#schema = schema;
        this.#name = name;
        this.#version = name.substring( 0, name.indexOf( "/" ) );
    }

    // properties
    get schema () {
        return this.#schema;
    }

    get name () {
        return this.#name;
    }

    get version () {
        return this.#version;
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

        const config = readConfig( `${location}/${this.name}.yaml` );

        if ( config.title ) this.#title = config.title;
        if ( config.description ) this.#description = config.description;
        if ( config.roles ) this.#roles = new Set( config.roles );

        // process methods
        for ( const [name, spec] of Object.entries( config.methods ) ) {
            this.#methods[name] ??= new Method( this, name );

            this.#methods[name].setSpec( spec );
        }
    }

    async loadApi ( api ) {
        var Super = [];

        for ( const location of this.#locations ) {
            const mixin = await import( url.pathToFileURL( `${location}/${this.name}.js` ) );

            Super.push( mixin.default );
        }

        Super.push( Base );

        this.#object = new ( class extends mixins( ...Super ) {} )( api );

        return result( 200 );
    }
}
