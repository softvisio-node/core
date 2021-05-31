import fs from "#lib/fs";
import _url from "url";
import Method from "./method.js";
import ajv from "#lib/ajv";

const SPEC_EXTENSION = ".schema.yaml";
const SPEC_VALIDATOR = ajv().addSchema( fs.config.read( "#resources/schemas/doc.meta.schema.yaml", { "resolve": import.meta.url } ) );

export default class Module {
    #schema;
    #url;
    #spec;
    #permissions;

    #extends;
    #methods = {};
    #namespace;
    #version;
    #object;

    constructor ( schema, url ) {
        this.#schema = schema;
        this.#url = url;

        this.#spec = fs.config.read( url + SPEC_EXTENSION );

        this.#spec.methods ||= {};

        // validate spec
        if ( !SPEC_VALIDATOR.validate( "method", this.#spec ) ) throw `Schema error in module "${this.#url}":\nspec:\n${JSON.stringify( this.#spec, null, 4 )}\nerrors:\n${JSON.stringify( SPEC_VALIDATOR.errors, null, 4 )}`;

        if ( this.#spec.extends ) {
            this.#extends = schema.loadModule( _url.pathToFileURL( fs.resolve( this.#spec.extends, url + ".js" ).replace( ".js", "" ) ) );

            // inherit module properties
            this.#spec.summary ??= this.#extends.summary;
            this.#spec.description ??= this.#extends.description;
            this.#spec.permissions ??= this.#extends.permissions;

            // inherit methods
            if ( this.#extends && this.#extends.spec.methods ) {
                for ( const method in this.#extends.spec.methods ) {
                    if ( this.#spec.methods[method] ) continue;

                    this.#spec.methods[method] = { ...this.#extends.spec.methods[method] };

                    // set this module permissions for the inherited methods
                    if ( this.#spec.permissions ) this.#spec.methods[method].permissions = this.#spec.permissions;
                }
            }
        }

        // convert module permissions to object
        if ( this.#spec.permissions ) this.#permissions = Object.keys( Object.fromEntries( this.#spec.permissions.map( permission => [permission, true] ) ) ).sort();

        if ( this.#url.startsWith( this.#schema.url ) ) {
            this.#namespace = this.#url.substr( this.#schema.url.length );

            this.#version = +this.#namespace.split( "/" )[1].replace( "v", "" );

            // create methods objects
            for ( const method in this.#spec.methods ) this.#methods[method] = new Method( this, method, this.#spec.methods[method] );
        }
    }

    get schema () {
        return this.#schema;
    }

    get url () {
        return this.#url;
    }

    get spec () {
        return this.#spec;
    }

    get summary () {
        return this.#spec.summary;
    }

    get description () {
        return this.#spec.description;
    }

    get permissions () {
        return this.#permissions;
    }

    get methods () {
        return this.#methods;
    }

    get namespace () {
        return this.#namespace;
    }

    get version () {
        return this.#version;
    }

    get object () {
        return this.#object;
    }

    // public
    async loadObject ( api ) {
        if ( this.#object ) return;

        const { "default": Class } = await import( this.#url + ".js" );

        this.#object = new Class( api );
    }
}
