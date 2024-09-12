import sql from "#lib/sql";

const SQL = {
    "getChatUrl": sql`SELECT chat_url FROM telegram_bot_external_chat WHERE telegram_bot_id = ?`.prepare(),

    "upsertChatUrl": sql`INSERT INTO telegram_bot_external_chat ( telegram_bot_id, chat_url ) VALUES ( ?, ? ) ON CONFLICT ( telegram_bot_id ) DO UPDATE SET chat_url = EXCLUDED.chat_url`.prepare(),
};

export default class {
    #bot;
    #chatUrl;

    constructor ( bot ) {
        this.#bot = bot;
    }

    // proprties
    get app () {
        return this.#bot.app;
    }

    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    get chatUrl () {
        return this.#chatUrl;
    }

    get isEnabled () {
        return !!this.#chatUrl;
    }

    // public
    async init () {
        this.bot.dbhEvents.on( "connect", this.#getChatUrl.bind( this ) );

        const res = await this.#getChatUrl();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    updateFields ( fields ) {
        if ( "chat_url" in fields && this.#chatUrl !== fields.chat_url ) {
            this.#chatUrl = fields.chat_url;

            this.#onUpdate();
        }
    }

    async setChatUrl ( url ) {
        url ||= null;

        if ( url ) {
            if ( url.startsWith( "@" ) ) {
                url = "https://t.me/" + url.slice( 1 );
            }

            if ( !URL.canParse( url ) ) return result( [ 400, `URL is not valid` ] );
        }

        if ( url === this.#chatUrl ) return result( 200 );

        const res = await this.dbh.do( SQL.upsertChatUrl, [ this.bot.id, url ] );
        if ( !res.ok ) return res;

        this.#chatUrl = url;

        this.#onUpdate();

        return result( 200 );
    }

    // private
    #onUpdate () {
        this.bot.commands.dropPermissionsCache();
    }

    async #getChatUrl () {
        const res = await this.dbh.selectRow( SQL.getChatUrl, [ this.bot.id ] );
        if ( !res.ok ) return res;

        this.#chatUrl = res.data?.chat_url || null;

        return res;
    }
}
