const { mixin } = require( "../../../mixins" );
const Smtp = require( "../../../api/smtp" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const q = {
    "loadAppSettings": sql`SELECT * FROM "settings" WHERE "id" = 1`.prepare(),
};

module.exports = mixin( Super =>
    class extends Super {
            #app;
            #dbh;
            #settings = {};
            #smtp;

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

                if ( !settings.ok ) return settings;

                this.#settings = settings.data;

                // SMTP
                this.#smtp = new Smtp( {
                    "host": this.#settings.smtp_host,
                    "port": this.#settings.smtp_port,
                    "username": this.#settings.smtp_username,
                    "password": this.#settings.smtp_password,
                    "tls": this.#settings.smtp_tls,
                } );

                this.#app.emit( "app/settings-updated", settings.data );

                return result( 200 );
            }

            async updateAppSettings ( settings, options = {} ) {
                const dbh = options.dbh || this.#dbh;

                var res = await dbh.do( sql`UPDATE "settings"`.SET( settings ).sql`WHERE "id" = 1` );

                if ( !res.ok ) return res;

                return this.loadAppSettings();
            }

            async sendMail ( args ) {
                if ( !args.from && this.#settings.smtp_from ) args = { ...args, "from": this.#settings.smtp_from };

                return this.#smtp.sendMail( args );
            }
    } );
