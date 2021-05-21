import Doc from "#lib/doc";
import _url from "url";
import env from "#lib/env";

const OK = result( 200 );

export default class APISchema {
    #isInitialized;
    #schema = {};
    #lastVersion;
    #logMethods;

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
                const Class = ( await import( objectId ) ).default;

                objects[objectId] = new Class( api );
            }

            schema[method].object = objects[objectId];
        }

        this.#schema = schema;

        return result( 200 );
    }

    get schema () {
        return this.#schema;
    }

    get lastVersion () {
        if ( !this.#lastVersion ) {
            Object.values( this.#schema )
                .map( spec => spec.method.apiVersion )
                .sort()
                .pop();
        }

        return this.#lastVersion;
    }

    // public
    checkMethodVersion ( method ) {
        if ( method.charAt( 0 ) === "/" ) return method;
        else return "/" + this.lastVersion + "/" + method;
    }

    getMethod ( id ) {
        return this.#schema[id];
    }

    findMethod ( id ) {
        const params = [];

        if ( this.#schema[id] ) return [id, params];

        while ( 1 ) {
            const id1 = id.replace( /_/g, "-" );

            if ( this.#schema[id1] ) return [id1, params];

            const idx = id.lastIndexOf( "/" );

            if ( idx === -1 ) return [null, params];

            params.unshift( id.substr( idx + 1 ) );

            id = id.substr( 0, idx );
        }
    }

    getLogMethods () {
        if ( !this.#logMethods ) {
            this.#logMethods = {};

            for ( const method of Object.keys( this.#schema ).sort() ) {
                if ( this.#schema[method].logApiCalls ) this.#logMethods[method] = this.#schema[method];
            }
        }

        return this.#logMethods;
    }

    validateMethodParams ( methodSpec, args ) {
        if ( methodSpec.validateParams !== false && methodSpec.validate( args ) ) return OK;

        // log validation errors
        if ( env.isDevelopment ) console.log( `Params validation errors for method "${methodSpec.method.id}":`, methodSpec.validate.errors );

        return result( [400, methodSpec.validate.errors.map( e => e.message ).join( "\n" )] );
    }
}
