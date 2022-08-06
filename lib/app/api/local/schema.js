import ApiSchema from "#lib/app/api/schema";

export default Super =>
    class ApiSchemaMixin extends ( Super || Object ) {
        #schema;

        async _init ( options ) {
            var res;

            if ( super._init ) {
                res = await super._init( options );
                if ( !res.ok ) return res;
            }

            process.stdout.write( `Loading API schema ... ` );

            this.#schema = new ApiSchema( options.apiSchema );

            res = this.#schema.loadSchema();

            // load api objects
            if ( res.ok ) res = await this.#schema.loadApi( this );

            // validate methods roles
            if ( res.ok && this._validateApiRoles ) {
                for ( const method of Object.values( this.#schema.methods ) ) {
                    res = this._validateApiRoles( method.roles );

                    if ( !res.ok ) {
                        res.statusText = `Roles for method "${method.id}"are invalid. ` + res.statusText;

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
