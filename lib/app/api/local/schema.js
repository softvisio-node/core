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

            this.#schema = new APISchema( options.apiSchema );

            this.#schema.loadSchema();

            res = await this.#schema.loadObjects( this );

            // validate methods permissions
            if ( res.ok ) {
                for ( const method of Object.values( this.#schema.methods ) ) {
                    res = this._validateApiPermissions( method.permissions );

                    if ( !res.ok ) {
                        res.reason = `Permissions for method "${method.id}"are invalid. ` + res.reason;

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
