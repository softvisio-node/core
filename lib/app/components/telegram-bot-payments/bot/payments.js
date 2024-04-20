import sql from "#lib/sql";
import TelegramWalletPayApi from "#lib/api/telegram/wallet-pay";

const SQL = {
    "init": sql`SELECT * FROM telegram_bot_wallet_pay WHERE telegram_bot_id = ?`,

    "setStorageApiKey": sql`INSERT INTO telegram_bot_wallet_pay ( telegram_bot_id, wallet_pay_storage_api_key ) VALUES ( ?, ? ) ON CONFLICT ( telegram_bot_id ) DO UPDATE SET wallet_pay_storage_api_key = EXCLUDED.wallet_pay_storage_api_key`,
};

export default class {
    #bot;
    #walletPaystorageApiKey = null;
    #walletPayApi;

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
        return !!this.#walletPaystorageApiKey;
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
        if ( "wallet_pay_storage_api_key" in fields ) {
            if ( fields.wallet_pay_storage_api_key ) {
                this.#setWalletPayStorageApiKey( this.app.crypto.decrypt( fields.wallet_pay_storage_api_key ) );
            }
            else {
                this.#setWalletPayStorageApiKey();
            }
        }
    }

    // XXX
    async checkOrder () {}

    createWebAppButton ( ctx, orderId ) {
        return {

            // XXX :purse;
            "text": l10nt( locale => "👛 " + locale.l10n( `Pay via Wallet` ) ),
            "web_app": {
                "url": ctx.createWebAooUrl( "wallet-pay", {
                    orderId,
                } ),
            },
        };
    }

    async setStorageApiKey ( walletPaystorageApiKey ) {
        walletPaystorageApiKey ||= null;

        if ( this.#walletPaystorageApiKey === walletPaystorageApiKey ) return result( 200 );

        const res = await this.dbh.do( SQL.setStorageApiKey, [ this.app.crypto.encrypt( walletPaystorageApiKey ), this.bot.id ] );
        if ( !res.ok ) return res;

        this.#setWalletPayStorageApiKey( walletPaystorageApiKey );

        return res;
    }

    // private
    #setWalletPayStorageApiKey ( walletPaystorageApiKey ) {
        this.#walletPaystorageApiKey = walletPaystorageApiKey || null;

        if ( this.#walletPaystorageApiKey ) {
            this.#walletPayApi = new TelegramWalletPayApi( this.#walletPaystorageApiKey );
        }
        else {
            this.#walletPayApi = null;
        }
    }
}
