export default Super =>
    class extends Super {

        // protected
        async _init () {
            var res;

            res = await super._init();
            if ( !res.ok ) return res;

            // init db
            res = await this.app.dbh.schema.migrate( new URL( "db", import.meta.url ) );
            if ( !res.ok ) return res;

            return result( 200 );
        }
    };
