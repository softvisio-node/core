import sql from "#lib/sql";
import Client from "./client.js";

const SQL = {
    "lockCreateClient": sql`SELECT pg_advisory_xact_lock( get_lock_id( 'telegram/telegram-client/create' ) )`.prepare(),

    "insertClient": sql`INSERT INTO telegram_client ( id, static, username, bot, session ) VALUES ( ?, ?, ?, ?, ? ) RETURNING id`.prepare(),

    "updateClient": sql`UPDATE telegram_client SET username = ?, session = ? WHERE id = ? RETURNING id`.prepare(),

    "getClients": sql`SELECT id FROM telegram_client`.prepare(),

    "loadClient": sql`SELECT * FROM telegram_client WHERE id = ?`.prepare(),

    "deleteClient": sql`DELETE FROM telegram_client WHERE id = ?`,
};

export default class {
    #telegram;
    #clients = {};
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
    // XXX
    async start () {
        if ( !this.isEnabled ) return result( 200 );

        var res;

        const ids = [];

        // create static clients
        if ( this.telegram.config.clients ) {
            for ( const session of this.telegram.config.clients ) {
                const res = await this.#createClient( {
                    session,
                    "isStatic": true,
                } );

                if ( !res.ok ) return res;

                ids.push( res.data.id );
            }
        }

        // delete static clients
        if ( this.telegram.config.clients ) {
            res = await this.dbh.do( sql`DELETE FROM telegram_client WHERE static = TRUE AND id NOT`.IN( ids ) );

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
            return this.#clients[ id ];
        }
        else {
            return this.#defaultClient;
        }
    }

    // XXX phone code handler
    async createClient ( accountId, { phoneCode, password, dbh } = {} ) {
        if ( !this.isEnabled ) return result( [ 500, `Telegram clients are disabled` ] );

        return this.#createClient( {
            accountId,
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
    // XXX
    async #createClient ( { isStatic, session, accountId, phoneCode, password, dbh } = {} ) {
        dbh ||= this.dbh;

        var res;

        // XXX phone code handler
        if ( !session ) {
            const client = new Client( this );

            res = await client.start( {
                accountId,
                password,
            } );

            if ( !res.ok ) return res;

            session = res.data;
        }

        const client = new Client( this, {
            session,
        } );

        res = await client.connect();
        if ( !res ) return result( [ 500, `Telegram client connection error` ] );

        res = await client.getMe();
        if ( !res.id ) return result( [ 400, "Telegram client session is not valid" ] );

        const id = res.id,
            username = res.username,
            bot = res.bot;

        await client.disconnect();

        res = await dbh.selectRow( SQL.loadClient, [ id ] );
        if ( !res.ok ) return res;

        if ( res.data ) {
            if ( !res.data.static && isStatic ) return result( [ 500, `Telegram client already exists` ] );
        }

        return dbh.begin( async dbh => {

            // lock transaction
            res = await dbh.selectRow( SQL.lockCreateClient );
            if ( !res.ok ) throw res;

            const encryptedSession = this.app.crypto.encrypt( session ).toString( "base64" );

            res = await dbh.selectRow( SQL.updateClient, [

                //
                username,
                encryptedSession,
                id,
            ] );
            if ( !res.ok ) throw res;

            if ( !res.data ) {
                res = await dbh.selectRow( SQL.insertClient, [

                    //
                    id,
                    isStatic,
                    username,
                    bot,
                    encryptedSession,
                ] );
                if ( !res.ok ) throw res;
            }

            return result( 200, {
                "id": res.data.id,
            } );
        } );
    }

    // XXX
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

    // XXX
    async #loadClient ( id ) {
        if ( this.#clients[ id ] ) return result( 200 );

        var res;

        res = await this.dbh.selectRow( SQL.loadClient, [ id ] );
        if ( !res.ok ) return res;

        const client = new Client( this.telegram, res.data );

        client.on( "readyChange", this.#setDefaultClient.bind( this ) );

        this.#clients[ id ] = client;

        res = await client.init();
        if ( !res.ok ) {
            console.warn( `Telegram client "${ client.phoneNumber }" init error:`, res + "" );

            if ( res.status === 401 && !client.isStatic ) {
                return result( 200 );
            }
            else {
                return res;
            }
        }

        return result( 200 );
    }

    async #unloadClients () {
        this.#unloading = true;

        const clients = this.#clients;

        this.#clients = {};
        this.#defaultClient = null;

        await Promise.all( Object.values( clients ).map( client => client.disconnect() ) );

        this.#unloading = false;

        return this.#loadClients();
    }

    async #unloadClient ( id ) {
        const client = this.getClient( id );

        if ( !client ) return;

        delete this.#clients[ client.id ];

        if ( this.#defaultClient === client ) {
            this.#defaultClient = null;

            this.#setDefaultClient();
        }

        await client.disconnect();
    }

    #setDefaultClient () {
        if ( this.#unloading ) {
            this.#defaultClient = null;

            return;
        }

        if ( this.#defaultClient ) return;

        for ( const client of Object.values( this.#clients ) ) {
            this.#defaultClient = client;

            return;
        }
    }
}
