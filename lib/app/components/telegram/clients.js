import sql from "#lib/sql";
import Client from "./client.js";

const SQL = {
    "lockCreateClient": sql`SELECT pg_advisory_xact_lock( get_lock_id( 'telegram/telegram-client/create' ) )`.prepare(),

    "insertClient": sql`INSERT INTO telegram_client ( id, static, bot, session ) VALUES ( ?, ?, ?, ? ) RETURNING id`.prepare(),

    "updateClient": sql`UPDATE telegram_client SET session = ? WHERE id = ? RETURNING id`.prepare(),

    "getClient": sql`SELECT * FROM telegram_client WHERE id = ?`,

    "deleteClient": sql`DELETE FROM telegram_client WHERE id = ?`,
};

export default class {
    #telegram;

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
    async init () {
        if ( !this.isEnabled ) return result( 200 );

        var res;

        const ids = [];

        // create static clients
        if ( this.telegram.config.clients ) {
            for ( const session of this.telegram.config.clients ) {
                const res = await this.#createClient( session, {
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

        return result( 200 );
    }

    async getClient ( id ) {
        var res;

        res = await this.dbh.selectRow( SQL.getClient, [ id ] );
        if ( !res.ok ) return res;

        if ( !res.data ) return result( 404 );

        const client = new Client( this, res.data );

        return result( 200, client );
    }

    // XXX
    async createClient ( accountId, { phoneCode, password, dbh } = {} ) {
        if ( !this.isEnabled ) return result( [ 500, `Telegram clients are disabled` ] );

        const client = new Client( this );

        var res;

        res = await client.start( {
            accountId,
            phoneCode,
            password,
        } );

        await client.disconnect();

        if ( !res.ok ) return res;

        return this.#createClient( res.data, {
            "isStatic": false,
            dbh,
        } );
    }

    async deleteClient ( id, { dbh } = {} ) {
        dbh ||= this.dbh;

        const res = await dbh.do( SQL.deleteClient, [ id ] );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // private
    async #createClient ( session, { isStatic, dbh } = {} ) {
        dbh ||= this.dbh;

        var res;

        const client = new Client( this, {
            session,
        } );

        res = await client.connect();
        if ( !res ) return result( [ 500, `Telegram client connection error` ] );

        res = await client.getMe();
        if ( !res.data?.id ) return result( [ 400, "Telegram client session is not valid" ] );

        const id = Number( res.data.id ),
            isBot = res.data.bot;

        await client.disconnect();

        res = await dbh.selectRow( SQL.getClient, [ id ] );
        if ( !res.ok ) return res;

        if ( res.data ) {
            if ( !res.data.static && isStatic ) return result( [ 500, `Telegram client already exists` ] );
        }

        return dbh.begin( async dbh => {

            // lock transaction
            res = await dbh.selectRow( SQL.lockCreateClient );
            if ( !res.ok ) throw res;

            const encryptedSession = await this.app.crypto.encrypt( session, {
                "outputEncoding": "base64",
            } );

            // update bot
            res = await dbh.selectRow( SQL.updateClient, [

                //
                encryptedSession,
                id,
            ] );
            if ( !res.ok ) throw res;

            // insert bot
            if ( !res.data ) {
                res = await dbh.selectRow( SQL.insertClient, [

                    //
                    id,
                    isStatic,
                    isBot,
                    encryptedSession,
                ] );
                if ( !res.ok ) throw res;
            }

            return result( 200, {
                "id": res.data.id,
            } );
        } );
    }
}
