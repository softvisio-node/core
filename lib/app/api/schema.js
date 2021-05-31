import Doc from "#lib/doc";
import _url from "url";
import env from "#lib/env";
import url from "url";
import glob from "glob";
import Module from "./schema/module.js";

const SPEC_EXTENSION = ".schema.yaml";

const OK = result( 200 );

export default class APISchema {
    #url;
    #isInitialized;
    #schema = {}; // XXX remove
    #modules = {};
    #methods = {};
    #logMethods;

    constructor ( url ) {
        this.#url = url + "";
    }

    // XXX pass url to doc
    async init ( api, url ) {
        if ( this.#isInitialized ) throw Error( "API schema is already initialized" );

        this.#isInitialized = true;

        const path = _url.fileURLToPath( url ),
            doc = new Doc( path ),
            schema = await doc.getApiSchema( "" ),
            objects = {};

        for ( const method in schema ) {
            schema[method].method.id = method;

            const objectId = _url.pathToFileURL( path + "/" + schema[method].apiClass + ".js" ).href;

            if ( !objects[objectId] ) {
                const { "default": Class } = await import( objectId );

                objects[objectId] = new Class( api );
            }

            schema[method].object = objects[objectId];
        }

        this.#schema = schema;

        return result( 200 );
    }

    get url () {
        return this.#url;
    }

    get methods () {
        return this.#methods;
    }

    // XXX remove
    get schema () {
        return this.#methods;
    }

    // public
    loadSchema () {
        const modules = glob.sync( "**/*" + SPEC_EXTENSION, { "cwd": url.fileURLToPath( this.#url ), "nodir": true } );

        for ( const file of modules ) {
            const module = this.loadModule( this.#url + "/" + file.replace( SPEC_EXTENSION, "" ) );

            for ( const method of Object.values( module.methods ) ) {
                this.#methods[method.id] = method;
            }
        }
    }

    async loadAPI ( api ) {
        for ( const method of Object.values( this.#methods ) ) await method.loadObject( api );
    }

    loadModule ( url ) {
        if ( this.#modules[url] ) return this.#modules[url];

        const module = new Module( this, url + "" );

        this.#modules[module.url] = module;

        return module;
    }

    getMethod ( id ) {
        return this.#methods[id];
    }

    findMethod ( id ) {
        const params = [];

        while ( 1 ) {
            if ( this.#methods[id] ) return [id, params];

            const idx = id.lastIndexOf( "/" );

            if ( idx === -1 ) return [null, params];

            params.unshift( id.substr( idx + 1 ) );

            id = id.substr( 0, idx );
        }
    }

    getLogMethods () {
        if ( !this.#logMethods ) {
            this.#logMethods = {};

            for ( const method of Object.keys( this.#methods ).sort() ) {
                if ( this.#methods[method].logApiCalls ) this.#logMethods[method] = this.#methods[method];
            }
        }

        return this.#logMethods;
    }

    // XXX remove
    validateMethodParams ( methodSpec, args ) {
        if ( methodSpec.validateParams !== false && methodSpec.validate( args ) ) return OK;

        // log validation errors
        if ( env.isDevelopment ) console.log( `Params validation errors for method "${methodSpec.method.id}":`, methodSpec.validate.errors );

        return result( [400, methodSpec.validate.errors.map( e => e.message ).join( "\n" )] );
    }
}
