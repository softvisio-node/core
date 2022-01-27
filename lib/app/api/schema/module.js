import _url from "url";
import Method from "./method.js";
import * as utils from "#lib/utils";
import { read as readConfig } from "#lib/config";
import validator from "./validator.js";

const SPEC_EXTENSION = ".yaml";

export default class Module {
    #schema;
    #url;
    #spec;
    #permissions;

    #extends;
    #methods = {};
    #namespace;
    #version;
    #name;
    #object;

    constructor ( schema, url ) {
        this.#schema = schema;
        this.#url = url;

        this.#spec = readConfig( url + SPEC_EXTENSION );

        this.#spec.methods ||= {};

        if ( this.#spec.extends ) {
            this.#extends = schema.loadModule( _url.pathToFileURL( utils.resolve( this.#spec.extends, url + ".js" ).replace( ".js", "" ) ) );

            // inherit module properties
            this.#spec.title ??= this.#extends.title;
            this.#spec.description ??= this.#extends.description;
            this.#spec.permissions ??= this.#extends.permissions;
            this.#spec.emits ??= this.#extends.emits;

            // inherit methods
            if ( this.#extends && this.#extends.spec.methods ) {
                for ( const method in this.#extends.spec.methods ) {

                    // has own method
                    if ( this.#spec.methods[method] ) continue;

                    this.#spec.methods[method] = { ...this.#extends.spec.methods[method] };

                    // set this module permissions for the inherited methods
                    if ( this.#spec.permissions ) this.#spec.methods[method].permissions = this.#spec.permissions;
                }
            }
        }

        // validate spec
        if ( !validator.validate( "module", this.#spec ) ) throw result( [500, `Schema error in module "${this.#url}":\n${JSON.stringify( validator.errors, null, 4 )}`] );

        // convert module permissions to object
        if ( this.#spec.permissions ) this.#permissions = Object.keys( Object.fromEntries( this.#spec.permissions.map( permission => [permission, true] ) ) ).sort();

        if ( this.#url.startsWith( this.#schema.url ) ) {
            this.#namespace = this.#url.substring( this.#schema.url.length );

            this.#version = +this.#namespace.split( "/" )[1].replace( "v", "" );

            this.#name = this.#namespace.replace( /^\/v\d+\//, "" );

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

    get title () {
        return this.#spec.title;
    }

    get description () {
        return this.#spec.description;
    }

    get permissions () {
        return this.#permissions;
    }

    get emits () {
        return this.spec.emits;
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

    get name () {
        return this.#name;
    }

    get object () {
        return this.#object;
    }

    // public
    async loadApi ( api ) {
        if ( this.#object ) return;

        const { "default": Class } = await import( this.#url + ".js" );

        this.#object = new Class( api );
    }
}
