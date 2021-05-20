import APISchema from "#lib/app/api/schema";

export default Super =>
    class APISchemaMixin extends ( Super || Object ) {
        #schema;

        async _init ( options ) {
            var res;

            if ( super._init ) {
                res = await super._init( options );
                if ( !res.ok ) return res;
            }

            const isAPI = !!this._validateApiPermissions;

            process.stdout.write( `Loading ${isAPI ? "API" : "RPC"} schema ... ` );

            this.#schema = new APISchema();

            res = await this.#schema.init( this, options.apiSchema );

            // validate methods permissions
            if ( res.ok && isAPI ) {
                for ( const methodSpec of Object.values( this.#schema.schema ) ) {
                    if ( !methodSpec.permissions ) {
                        res = result( [400, `Permissions for method "${methodSpec.method.id}"are not defined`] );

                        break;
                    }

                    res = this._validateApiPermissions( methodSpec.permissions );

                    if ( !res.ok ) break;
                }
            }

            console.log( res + "" );

            if ( !res.ok ) return res;

            return res;
        }

        get schema () {
            return this.#schema;
        }
    };
