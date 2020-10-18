const { mixin } = require( "../../../mixins" );
const Smtp = require( "../../../smtp" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );

const ID = 1;

const q = {
    "loadAppSettings": sql`SELECT * FROM "settings" WHERE "id" = ${ID}`.prepare(),
};

module.exports = mixin( Super =>
    class extends Super {
            #settingsUpdated;
            #settings = {};
            #smtp;

            get appSettings () {
                return this.#settings;
            }

            async loadAppSettings () {
                var settings = await this.dbh.selectRow( q.loadAppSettings );

                // error
                if ( !settings.ok ) return settings;

                // init settings
                if ( !settings.data || ( process.cli.options["reset-settings"] && !this.#settingsUpdated ) ) {
                    this.#settingsUpdated = true;

                    const values = { ...this.app.env.settings } || {};

                    let res;

                    // insert
                    if ( !settings.data ) {
                        values.id = ID;

                        res = await this.dbh.do( sql`INSERT INTO "settings"`.VALUES( [values] ) );
                    }

                    // update
                    else {
                        res = await this.dbh.do( sql`UPDATE "settings"`.SET( values ).sql`WHERE "id" = ${ID}` );
                    }

                    // error
                    if ( !res.ok ) return res;

                    settings = await this.dbh.selectRow( q.loadAppSettings );

                    // error
                    if ( !settings.ok ) return settings;
                }

                this.#settings = settings.data;

                // SMTP
                this.#smtp = new Smtp( {
                    "host": this.#settings.smtp_host,
                    "port": this.#settings.smtp_port,
                    "username": this.#settings.smtp_username,
                    "password": this.#settings.smtp_password,
                    "tls": this.#settings.smtp_tls,
                } );

                this.app.emit( "app/settings-updated", settings.data );

                return result( 200 );
            }

            async updateAppSettings ( settings, options = {} ) {
                const dbh = options.dbh || this.dbh;

                var res = await dbh.do( sql`UPDATE "settings"`.SET( settings ).sql`WHERE "id" = ${ID}` );

                if ( !res.ok ) return res;

                return this.loadAppSettings();
            }

            async sendMail ( args ) {
                if ( !args.from && this.#settings.smtp_from ) args = { ...args, "from": this.#settings.smtp_from };

                return this.#smtp.sendMail( args );
            }
    } );
