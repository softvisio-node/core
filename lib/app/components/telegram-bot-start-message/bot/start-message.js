import sql from "#lib/sql";

const SQL = {
    "getStartMessage": sql`SELECT telegram_bot_message_id FROM telegram_bot_start_message WHERE telegram_bot_id = ?`,
};

export default class {
    #bot;
    #messageId;

    constructor ( bot ) {
        this.#bot = bot;
    }

    // public
    async getMessage () {
        return this.#bot.messages.getMessage( this.#messageId );
    }

    async init () {
        var res;

        res = await this.#bot.dbh.selectRow( SQL.getStartMessage, [ this.#bot.id ] );
        if ( !res.ok ) return res;

        this.#messageId = res.data.telegram_bot_message_id;

        return result( 200 );
    }
}
