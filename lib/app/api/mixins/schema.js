import Doc from "#lib/doc";
import _url from "url";

export default Super =>
    class Schema extends ( Super || Object ) {
        #schema = {};
        #logMethods;
        #stat = {};

        async _init ( options ) {
            var res;

            if ( super._init ) {
                res = await super._init( options );
                if ( !res.ok ) return res;
            }

            // init methods
            process.stdout.write( "Loading API schema ... " );
            res = await this.#loadSchema( options.apiSchema );
            console.log( res + "" );
            if ( !res.ok ) return res;

            return res;
        }

        get stat () {
            return this.#stat;
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

        // private
        // XXX pass url to doc
        async #loadSchema ( url ) {
            const path = _url.fileURLToPath( url ),
                doc = new Doc( path ),
                schema = await doc.getApiSchema( "" ),
                objects = {};

            for ( const methodId in schema ) {
                schema[methodId].method.id = methodId;

                // validate permissions
                const res = this._validateSchemaPermissions( schema[methodId] );

                // permissions are invalid
                if ( !res.ok ) return res;

                const objectId = _url.pathToFileURL( path + "/" + schema[methodId].apiClass + ".js" ).href;

                if ( !objects[objectId] ) {
                    const Class = ( await import( objectId ) ).default;

                    objects[objectId] = new Class( this );
                }

                schema[methodId].object = objects[objectId];
            }

            this.#schema = schema;

            return result( 200 );
        }

        _validateSchemaPermissions ( methodSpec ) {
            if ( !methodSpec.permissions ) return result( [400, `Permissions for method "${methodSpec.method.id}"are not defined`] );

            return this.validateApiPermissions( methodSpec.permissions );
        }
    };
