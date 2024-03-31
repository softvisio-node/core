import sql from "#lib/sql";
import Client from "./client.js";

const SQL = {
    "getClientByPhoneNumber": sql`SELECT id, static FROM telegram_client WHERE phone_number = ?`.prepare(),

    "lockCreateBot": sql`SELECT pg_advisory_xact_lock( get_lock_id( 'telegram/telegram-client/create' ) )`.prepare(),

    "updateClient": sql`UPDATE telegram_client SET phone_code = ?, password = ? WHERE phone_number = ? RETURNING id`.prepare(),

    "insertClient": sql`INSERT INTO telegram_client ( phone_number, static, phone_code, password ) VALUES ( ?, ?, ?, ? ) RETURNING id`.prepare(),

    "getClients": sql`SELECT id FROM telegram_client`.prepare(),

    "loadClient": sql`SELECT id, phone_number, static, phone_code, password FROM telegram_client WHERE id = ?`.prepare(),

    "deleteClient": sql`DELETE FROM telegram_client WHERE id = ?`,
};

export default class {
    #telegram;
    #clients = {};
    #clientsPhoneNumber = {};
    #defaultClient;
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

    // public
    async start () {
        if ( !this.isEnabled ) return result( 200 );

        var res;

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

        // set listeners
        this.dbh.on( "connect", this.#loadClients.bind( this ) );

        this.dbh.on( "disconnect", this.#unloadClients.bind( this ) );

        this.dbh.on( "telegram/telegram-client/create", async data => {
            await this.#loadClient( data.id );
        } );

        this.dbh.on( "telegram/telegram-client/update", data => this.getClient( data.id )?.updateFields( data ) );

        this.dbh.on( "telegram/telegram-client/delete", async data => {
            this.#unloadClient( data.id );
        } );

        // load clients
        res = await await this.#loadClients();
        if ( !res.ok ) return res;

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
        if ( !this.isEnabled ) return result( [ 500, `Telegram clients are disabled` ] );

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
                var encryptedPhoneCode = this.app.crypto.encrypt( phoneCode ).toString( "base64" );
            }

            if ( password ) {
                var encryptedPassword = this.app.crypto.encrypt( password ).toString( "base64" );
            }

            res = await dbh.selectRow( SQL.updateClient, [

                //
                encryptedPhoneCode,
                encryptedPassword,
                phoneNumber,
            ] );
            if ( !res.ok ) throw res;

            if ( !res.data ) {
                res = await dbh.selectRow( SQL.insertClient, [

                    //
                    phoneNumber,
                    isStatic,
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

    async #loadClients () {
        if ( this.#isShuttingDown ) return result( 500 );
        if ( this.#unloading ) return result( 500 );
        if ( !this.dbh.isConnected ) return result( 500 );

        const clients = await this.dbh.select( SQL.getClients );
        if ( !clients.ok ) return clients;

        // load bots
        for ( const { id } of clients.data || [] ) {
            const res = await this.#loadClient( id );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async #loadClient ( id ) {
        if ( this.#clients[ id ] ) return result( 200 );

        var res;

        res = await this.dbh.selectRow( SQL.loadClient, [ id ] );
        if ( !res.ok ) return res;

        const client = new Client( this.telegram, res.data );

        client.on( "readyChange", this.#setDefaultClient.bind( this ) );

        this.#clients[ id ] = client;
        this.#clientsPhoneNumber[ client.phoneNumber ] = client;

        res = await client.init();
        if ( !res.ok ) {
            console.error( `Telegram client "${ client.phoneNumber }" init error:`, res + "" );

            return res;
        }

        return result( 200 );
    }

    async #unloadClients () {
        this.#unloading = true;

        const clients = this.#clients;

        this.#clients = {};
        this.#clientsPhoneNumber = {};
        this.#defaultClient = null;

        await Promise.all( Object.values( clients ).map( client => client.shutDown() ) );

        this.#unloading = false;

        return this.#loadClients();
    }

    async #unloadClient ( id ) {
        const client = this.getClient( id );

        if ( !client ) return;

        delete this.#clients[ client.id ];
        delete this.#clientsPhoneNumber[ client.phoneNumber ];

        if ( this.#defaultClient === client ) {
            this.#defaultClient = null;

            this.#setDefaultClient();
        }

        return client.shutDown();
    }

    #setDefaultClient () {
        if ( this.#unloading ) {
            this.#defaultClient = null;

            return;
        }

        if ( this.#defaultClient?.isReady ) return;

        this.#defaultClient = null;

        for ( const client of Object.values( this.#clients ) ) {
            if ( client.isReady ) {
                this.#defaultClient = client;

                return;
            }
        }
    }
}
