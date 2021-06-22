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

        async _init ( options = {} ) {
            process.stdout.write( "Loading app settings ... " );

            var res = await this.#loadSettings();

            console.log( res + "" );

            // dbh error
            if ( !res.ok && res.status !== 404 ) return res;

            // init settings
            if ( res.status === 404 || process.cli?.options["reset-settings"] ) {
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

                res = await this.#loadSettings( true );

                console.log( res + "" );

                // error
                if ( !res.ok ) return res;

                if ( process.cli?.options["reset-settings"] ) process.exit();
            }

            // setup dbh events
            this.dbh.on( "event/api/settings-update", this._loadSettings.bind( this ) );
            await this.dbh.waitReady();

            this.dbh.on( "connect", this._loadSettings.bind( this ) );

            res = super._init ? await super._init( options ) : result( 200 );

            return res;
        }

        get settings () {
            return this.#settings;
        }

        async _loadSettings () {
            this.#mutex.signal.up = true;

            if ( !this.#mutex.tryDown() ) return this.#mutex.signal.wait();

            var res;

            // try to load until success
            while ( 1 ) {
                this.#mutex.signal.up = false;

                res = await this.#loadSettings();

                // redo, if load signal was received while update was performed
                if ( this.#mutex.signal.up ) continue;

                if ( res.ok ) break;
            }

            this.emit( "settings-update", this.#settings );

            this.#mutex.up();

            this.#mutex.signal.broadcast( res );

            return res;
        }

        async #loadSettings () {
            const res = await this.dbh.selectRow( QUERIES.read );

            // dbh error
            if ( !res.ok ) return res;

            // settings not initialized
            if ( !res.data ) return result( 404 );

            this.#settings = res.data;

            this.#onUpdated();

            return result( 200 );
        }

        async updateSettings ( settings, options = {} ) {
            const dbh = options.dbh || this.dbh;

            delete settings.id;
            delete settings.updated;

            var res = await dbh.do( sql`UPDATE "settings"`.SET( settings ).sql`WHERE "id" = ${ID}` );

            if ( !res.ok ) return res;

            this.#settings = { ...this.#settings, ...settings };

            this.#onUpdated();

            return result( 200 );
        }

        #onUpdated () {

            // SMTP
            this.#smtp = new Smtp( {
                "hostname": this.#settings.smtp_hostname,
                "port": this.#settings.smtp_port,
                "username": this.#settings.smtp_username,
                "password": this.#settings.smtp_password,
            } );
        }

        async sendMail ( args ) {
            if ( !args.from && this.#settings.smtp_from ) args = { ...args, "from": this.#settings.smtp_from };

            return this.#smtp.sendMail( args );
        }
    };
