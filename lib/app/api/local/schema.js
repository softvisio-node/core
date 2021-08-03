import APISchema from "#lib/api/schema";

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

            res = this.#schema.loadSchema();

            // load api objects
            if ( res.ok ) res = await this.#schema.loadAPI( this );

            // validate methods permissions
            if ( res.ok && this._validateApiPermissions ) {
                for ( const method of Object.values( this.#schema.methods ) ) {
                    res = this._validateApiPermissions( method.permissions );

                    if ( !res.ok ) {
                        res.statusText = `Permissions for method "${method.id}"are invalid. ` + res.statusText;

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
