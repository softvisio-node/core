require( "@softvisio/core" );
const Smtp = require( "../../../smtp" );
const sql = require( "../../../sql" );

const ID = 1;

const QUERIES = {
    "loadAppSettings": sql`SELECT * FROM "settings" WHERE "id" = ${ID}`.prepare(),
};

module.exports = Super =>
    class extends ( Super || Object ) {
        #settings = {};
        #smtp;

        async $init ( options = {} ) {
            process.stdout.write( "Loading app settings ... " );

            var res = await this.#loadAppSettings( true );

            console.log( res + "" );

            // dbh error
            if ( !res.ok && res.status !== 404 ) return res;

            // init settings
            if ( res.status === 404 || process.cli.options["reset-settings"] ) {
                process.stdout.write( "Updating app settings ... " );

                const values = { ...this.app.env.settings } || {};

                // insert
                if ( res.status === 404 ) {
                    values.id = ID;

                    res = await this.dbh.do( sql`INSERT INTO "settings"`.VALUES( values ) );
                }

                // update
                else {
                    res = await this.dbh.do( sql`UPDATE "settings"`.SET( values ).sql`WHERE "id" = ${ID}` );
                }

                // error
                if ( !res.ok ) {
                    console.log( res + "" );

                    return res;
                }

                res = await this.#loadAppSettings( true );

                console.log( res + "" );

                // error
                if ( !res.ok ) return res;

                if ( process.cli.options["reset-settings"] ) process.exit();
            }

            res = super.$init ? await super.$init( options ) : result( 200 );

            return res;
        }

        get appSettings () {
            return this.#settings;
        }

        async #loadAppSettings ( init ) {
            var settings = await this.dbh.selectRow( QUERIES.loadAppSettings );

            // dbh error
            if ( !settings.ok ) return settings;

            // settings not initialized
            if ( !settings.data ) return result( 404 );

            this.#settings = settings.data;

            // SMTP
            this.#smtp = new Smtp( {
                "hostname": this.#settings.smtp_hostname,
                "port": this.#settings.smtp_port,
                "username": this.#settings.smtp_username,
                "password": this.#settings.smtp_password,
            } );

            if ( !init ) this.app.publish( "*/app/settings/update", settings.data );

            return result( 200 );
        }

        async updateAppSettings ( settings, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var res = await dbh.do( sql`UPDATE "settings"`.SET( settings ).sql`WHERE "id" = ${ID}` );

            if ( !res.ok ) return res;

            return this.#loadAppSettings();
        }

        async sendMail ( args ) {
            if ( !args.from && this.#settings.smtp_from ) args = { ...args, "from": this.#settings.smtp_from };

            return this.#smtp.sendMail( args );
        }
    };
