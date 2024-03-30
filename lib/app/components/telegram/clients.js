import sql from "#lib/sql";
import crypto from "node:crypto";

// import Client from "./client.js";

const SQL = {
    "getClientByPhoneNumber": sql`SELECT id, ststic FROM telegram_client WHERE phone_number = ?`.prepare(),

    "lockCreateBot": sql`SELECT pg_advisory_xact_lock( get_lock_id( 'telegram/telegram-client/create' ) )`.prepare(),

    "updateClient": sql`UPDATE telegram_client SET phone_code = ?, password = ? WHERE phone_number = ? RETURNING id`.prepare(),

    "insertClient": sql`INSERT INTO telegram_client ( phone_number, static, app_hash, phone_code, password ) VALUES ( ?, ?, ?, ?, ? ) ON CONFLICT ( phone_number ) DO UPDATE SET app_hash = EXCLUDED.app_hash RETURNING id`.prepare(),

    "deleteClient": sql`DELETE FROM telegram_client WHERE id = ?`,
};

export default class {
    #telegram;
    #clients = {};
    #clientsPhoneNumber = {};
    #defaultClient;
    #appHash;
    #isShuttingDown;
    #unloading;

    constructor ( telegram ) {
        this.#telegram = telegram;
    }

    // properties
    get telegram () {
        return this.#telegram;
    }

    get app () {
        return this.#telegram.app;
    }

    get dbh () {
        return this.#telegram.app.dbh;
    }

    get isEnabled () {
        if ( !this.telegram.config.app.apiId || !this.telegram.config.app.apiHash ) return false;

        return true;
    }

    get appHash () {
        return ( this.$appHash ??= crypto
            .createHash( "md5" )
            .update( !this.telegram.config.app.apiId + "/" + !this.telegram.config.app.apiHash )
            .digest( "base64url" ) );
    }

    // public
    // XXX
    async start () {
        if ( !this.isEnabled ) return result( 200 );

        var res;

        // drop storage if app hash changed
        res = await this.dbh.do( sql`UPDATE telegram_client SET app_hash = ?, storage = NULL WHERE app_hash != ?`, [ this.appHash, this.appHash ] );
        if ( !res.ok ) return res;

        // create static clients
        if ( this.telegram.config.clients ) {
            for ( const clientConfig of this.telegram.config.clients ) {
                const res = await this.#createClient( {
                    ...clientConfig,
                    "isStatic": true,
                } );

                if ( !res.ok ) return res;
            }
        }

        // delete static clients
        if ( this.telegram.config.clients ) {
            res = await this.dbh.do( sql`DELETE FROM telegram_client WHERE static = TRUE AND phone_number NOT`.IN( this.telegram.config.clients.map( client => client.phoneNumber ) ) );

            if ( !res.ok ) return res;
        }
        else {
            res = await this.dbh.do( sql`DELETE FROM telegram_client WHERE static = TRUE` );

            if ( !res.ok ) return res;
        }

        // XXX load clients

        // XXX set listeners
        this.dbh.on( "connect", this.#loadClients.bind( this ) );

        this.dbh.on( "disconnect", this.#unloadClients.bind( this ) );

        this.dbh.on( "telegram/telegram-client/create", async data => {
            await this.#loadClient( data.id );
        } );

        // XXX
        this.dbh.on( "telegram/telegram-client/update", data => this.getClient( data.id )?.updateTelegramBotFields( data ) );

        // this.dbh.on("telegram/telegram-client/deleted/update", async data => {
        //     if (data.deleted) {
        //         this.#unloadBot(data.id);
        //     } else {
        //         const bot = await this.#loadBot(data.id, data.type);

        //         if (bot) bot.start();
        //     }
        // });

        await this.#loadClients();

        this.#setDefaultClient();

        return result( 200 );
    }

    async shutDown () {
        this.#isShuttingDown = true;

        return this.#unloadClients();
    }

    getClient ( id ) {
        if ( id ) {
            return this.#clients[ id ] || this.#clientsPhoneNumber[ id ];
        }
        else {
            return this.#defaultClient;
        }
    }

    async createClient ( phoneNumber, { phoneCode, password, dbh } = {} ) {
        return this.#createClient( {
            phoneNumber,
            "isStatic": false,
            phoneCode,
            password,
            dbh,
        } );
    }

    async deleteClient ( id, { dbh } = {} ) {
        const client = this.getClient( id );

        if ( !client ) return result( 404 );

        if ( client.isStatic ) return result( 400 );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.deleteClient, [ client.id ] );
        if ( !res.ok ) return res;

        await this.#unloadClient( client.id );

        return result( 200 );
    }

    // private
    async #createClient ( { isStatic, phoneNumber, phoneCode, password, dbh } = {} ) {
        dbh ||= this.dbh;

        var res;

        res = await dbh.selectRow( SQL.getClientByPhoneNumber, [ phoneNumber ] );
        if ( !res.ok ) return res;

        if ( res.data ) {
            if ( !res.data.static && isStatic ) return result( [ 500, `Telegram client already exists` ] );
        }

        return dbh.begin( async dbh => {

            // lock transaction
            res = await dbh.selectRow( SQL.lockCreateBot );
            if ( !res.ok ) throw res;

            if ( phoneCode ) {
                var encryptedPhoneCode = this.app.crypto.encrypt( phoneCode, { "encoding": "base64url" } );
            }

            if ( password ) {
                var encryptedPassword = this.app.crypto.encrypt( password, { "encoding": "base64url" } );
            }

            res = await dbh.selectRow( SQL.updateClient, [

                //
                encryptedPhoneCode,
                encryptedPassword,
            ] );
            if ( !res.ok ) throw res;

            if ( !res.data ) {
                res = await dbh.selectRow( SQL.insertClient, [

                    //
                    phoneNumber,
                    isStatic,
                    this.appHash,
                    encryptedPhoneCode,
                    encryptedPassword,
                ] );
                if ( !res.ok ) throw res;
            }

            return result( 200, {
                "id": res.data.id,
            } );
        } );
    }

    // XXX
    async #loadClients () {}

    async #unloadClients () {
        this.#unloading = true;

        const clients = this.#clients;

        this.#clients = {};
        this.#clientsPhoneNumber = {};
        this.#defaultClient = null;

        await Promise.all( Object.values( clients ).map( client => client.shutDown() ) );

        this.#unloading = false;

        this.#loadClients();
    }

    async #unloadClient ( id ) {
        const client = this.getClient( id );

        if ( !client ) return;

        delete this.#clients[ client.id ];
        delete this.#clientsPhoneNumber[ client.phoneNumber ];

        this.#setDefaultClient();

        return client.shutDown();
    }

    #setDefaultClient () {
        this.#defaultClient = null;

        for ( const client of Object.values( this.#clients ) ) {
            if ( client.isEnabled ) {
                this.#defaultClient = client;

                break;
            }
        }
    }

    // XXX
    async #loadClient () {}
}
