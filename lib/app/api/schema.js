import Doc from "#lib/doc";
import _url from "url";

export default class APISchema {
    #isInitialized;
    #schema = {};
    #logMethods;

    // XXX pass url to doc
    async init ( api, url ) {
        if ( this.#isInitialized ) throw Error( "API schema is already initialized" );

        this.#isInitialized = true;

        const path = _url.fileURLToPath( url ),
            doc = new Doc( path ),
            schema = await doc.getApiSchema( "" ),
            objects = {};

        for ( const methodId in schema ) {
            schema[methodId].method.id = methodId;

            const objectId = _url.pathToFileURL( path + "/" + schema[methodId].apiClass + ".js" ).href;

            if ( !objects[objectId] ) {
                const Class = ( await import( objectId ) ).default;

                objects[objectId] = new Class( api );
            }

            schema[methodId].object = objects[objectId];
        }

        this.#schema = schema;

        return result( 200 );
    }

    get schema () {
        return this.#schema;
    }

    // public
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

            for ( const methodId of Object.keys( this.#schema ).sort() ) {
                if ( this.#schema[methodId].logApiCalls ) this.#logMethods[methodId] = this.#schema[methodId];
            }
        }

        return this.#logMethods;
    }
}
