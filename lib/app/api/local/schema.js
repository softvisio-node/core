import ApiSchema from "#lib/app/api/schema";

export default Super =>
    class ApiSchemaMixin extends ( Super || Object ) {
        #schema;

        async _init ( options ) {
            var res;

            process.stdout.write( `Loading API schema ... ` );

            this.#schema = new ApiSchema( options.apiSchema );

            res = this.#schema.loadSchema();

            if ( !res.ok ) return res;

            console.log( res + "" );

            if ( super._init ) res = await super._init( options );

            return res;
        }

        async _initApiObjects () {
            process.stdout.write( `Loading API objects ... ` );

            // load api objects
            const res = await this.#schema.loadApi( this );

            console.log( res + "" );

            return res;
        }

        get schema () {
            return this.#schema;
        }
    };
