import { readConfig } from "#lib/config";
import Method from "./method.js";

export default class {
    #schema;
    #namespace;
    #version;
    #locations = [];
    #title;
    #description;
    #roles = new Set( ["*"] );
    #emits = new Set();
    #methods = {};

    constructor ( schema, namespace ) {
        this.#schema = schema;
        this.#namespace = namespace;
        this.#version = namespace.substring( 0, namespace.indexOf( "/" ) );
    }

    // properties
    get schema () {
        return this.#schema;
    }

    get namespace () {
        return this.#namespace;
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

    // public
    addLocation ( location ) {
        this.#locations.unshift( location );

        const config = readConfig( `${location}/${this.namespace}.yaml` );

        if ( config.title ) this.#title = config.title;
        if ( config.description ) this.#description = config.description;
        if ( config.roles ) this.#roles = new Set( config.roles );

        // process methods
        for ( const [name, spec] of Object.entries( config.methods ) ) {
            this.#methods[name] ??= new Method( this, name );

            this.#methods[name].setSpec( spec );
        }
    }
}
