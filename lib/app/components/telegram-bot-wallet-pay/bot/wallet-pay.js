import sql from "#lib/sql";
import TelegramWalletPayApi from "#lib/api/telegram/wallet-pay";

const SQL = {
    "init": sql`SELECT * FROM telegram_bot_wallet_pay WHERE telegram_bot_id = ?`,

    "setStorageApiKey": sql`INSERT INTO telegram_bot_wallet_pay ( telegram_bot_id, storage_api_key ) VALUES ( ?, ? ) ON CONFLICT ( telegram_bot_id ) DO UPDATE SET storage_api_key = EXCLUDED.storage_api_key`,
};

export default class {
    #bot;
    #storageApiKey = null;
    #api;

    constructor ( bot ) {
        this.#bot = bot;
    }

    // properties
    get app () {
        return this.#bot.app;
    }

    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    get isEnabled () {
        return !!this.#storageApiKey;
    }

    // public
    async init () {
        var res;

        res = this.dbh.selectRow( SQL.init, [ this.bot.id ] );
        if ( !res.ok ) return res;

        if ( res.data ) this.updateFields( res.data );

        return result( 200 );
    }

    updateFields ( fields ) {
        if ( "storage_api_key" in fields ) {
            if ( fields.storage_api_key ) {
                this.#setStorageApiKey( this.app.crypto.decrypt( fields.storage_api_key ) );
            }
            else {
                this.#setStorageApiKey();
            }
        }
    }

    // XXX
    async checkOrder () {}

    async setStorageApiKey ( storageApiKey ) {
        storageApiKey ||= null;

        if ( this.#storageApiKey === storageApiKey ) return result( 200 );

        const res = await this.dbh.do( SQL.setStorageApiKey, [ storageApiKey, this.bot.id ] );
        if ( !res.ok ) return res;

        this.#setStorageApiKey( storageApiKey );

        return res;
    }

    // private
    #setStorageApiKey ( storageApiKey ) {
        this.#storageApiKey = storageApiKey || null;

        if ( this.#storageApiKey ) {
            this.#api = new TelegramWalletPayApi( this.#storageApiKey );
        }
        else {
            this.#api = null;
        }
    }
}
