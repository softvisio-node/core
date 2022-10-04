export default Super =>
    class ApiSchemaMixin extends ( Super || Object ) {
        #schema;

        async _init () {
            var res;

            process.stdout.write( `Loading API schema ... ` );

            res = this.isApi ? this.app.components.getApiSchema() : this.app.components.getRpcSchema();

            console.log( res + "" );

            if ( !res.ok ) return res;

            this.#schema = res.data;

            if ( super._init ) res = await super._init();

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
