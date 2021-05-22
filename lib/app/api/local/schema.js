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

            process.stdout.write( `Loading API schema ... ` );

            this.#schema = new APISchema();

            res = await this.#schema.init( this, options.apiSchema );

            // validate methods permissions
            if ( res.ok ) {
                for ( const methodSpec of Object.values( this.#schema.schema ) ) {
                    if ( !methodSpec.permissions ) {
                        res = result( [400, `Permissions for method "${methodSpec.method.id}"are not defined`] );

                        break;
                    }

                    res = this._validateApiPermissions( methodSpec.permissions );

                    if ( !res.ok ) {
                        res.reason = `Permissions for method "${methodSpec.method.id}"are invalid. ` + res.reason;

                        break;
                    }
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
