import "#index";

import Smtp from "#lib/smtp";
import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";

const ID = 1;

const QUERIES = {
    "read": sql`SELECT * FROM "settings" WHERE "id" = ${ID}`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {
        #mutex = new Mutex();
        #settings = {};
        #smtp;

        // public
        async getSettings () {
            if ( this.#settings ) return this.#settings;

            if ( !this.#mutex.tryDown() ) return this.#mutex.signal.wait();

            // try to load until success
            while ( 1 ) {
                const res = await this.#loadSettings();

                if ( res.ok ) break;
            }

            this.#mutex.up();
            this.#mutex.signal.broadcast( this.#settings );

            return this.#settings;
        }

        async updateSettings ( settings, options = {} ) {
            const dbh = options.dbh || this.dbh;

            this.#reset();

            delete settings.id;
            delete settings.updated;

            var res = await dbh.do( sql`UPDATE "settings"`.SET( settings ).sql`WHERE "id" = ${ID}` );

            if ( !res.ok ) return res;

            return result( 200 );
        }

        async sendMail ( options = {} ) {
            const settings = await this.getSettings();

            if ( !this.#smtp ) {
                this.#smtp = new Smtp( {
                    "hostname": settings.smtp_hostname,
                    "port": settings.smtp_port,
                    "username": settings.smtp_username,
                    "password": settings.smtp_password,
                } );
            }

            if ( !options.from && settings.smtp_from ) options = { ...options, "from": settings.smtp_from };

            return this.#smtp.sendMail( options );
        }

        // protected
        async _init ( options = {} ) {
            process.stdout.write( "Loading app settings ... " );

            // setup dbh events
            this.dbh.on( "event/api/settings-update", async () => {
                this.#reset();

                const settings = await this.getSettings();

                this.emit( "settings-update", settings );
            } );
            await this.dbh.waitReady();

            // load settings
            var res = await this.#loadSettings();

            console.log( res + "" );

            // dbh error
            if ( !res.ok && res.status !== 404 ) return res;

            // init settings
            if ( res.status === 404 || process.cli?.options["reset-settings"] ) {
                process.stdout.write( "Updating app settings ... " );

                const values = { ...this.app.env.settings } || {};

                // init settings
                if ( res.status === 404 ) {
                    values.id = ID;

                    res = await this.dbh.do( sql`INSERT INTO "settings"`.VALUES( values ) );
                }

                // reset settings
                else {
                    res = await this.dbh.do( sql`UPDATE "settings"`.SET( values ).sql`WHERE "id" = ${ID}` );
                }

                console.log( res + "" );

                // error
                if ( !res.ok ) return res;

                if ( process.cli?.options["reset-settings"] ) process.exit();
            }

            res = super._init ? await super._init( options ) : result( 200 );

            return res;
        }

        // private
        async #loadSettings () {
            this.#reset();

            const res = await this.dbh.selectRow( QUERIES.read );

            // dbh error
            if ( !res.ok ) return res;

            // settings not initialized
            if ( !res.data ) return result( 404 );

            this.#settings = res.data;

            return result( 200 );
        }

        #reset () {
            this.#settings = null;
            this.#smtp = null;
        }
    };
