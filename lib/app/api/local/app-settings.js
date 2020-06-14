const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const q = {
    "loadAppSettings": sql`SELECT * FROM "settings" WHERE "id" = 1`.prepare(),
};

module.exports = mixin( ( Super ) =>
    class extends Super {
            #app;
            #dbh;
            #settings = {};

            constructor ( app, dbh ) {
                super( app, dbh );

                this.#app = app;
                this.#dbh = dbh;
            }

            getAppSettings () {
                return this.#settings;
            }

            async loadAppSettings () {
                var settings = await this.#dbh.selectRow( q.loadAppSettings );

                if ( !settings.isOk() ) return settings;

                this.#settings = settings.data;

                this.#app.emit( "app/settings-updated", settings.data );

                return result( 200 );
            }

            async updateAppSettings ( settings ) {
                var res = await this.#dbh.do( sql`UPDATE "settings"`.SET( settings ).sql`WHERE "id" = 1` );

                if ( !res.isOk() ) return res;

                return this.loadAppSettings();
            }
    } );
