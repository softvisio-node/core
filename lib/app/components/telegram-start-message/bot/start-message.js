import sql from "#lib/sql";

const SQL = {
    "getStartMessage": sql`SELECT telesgram_message_id FROM telegram_bot_start_message WHERE telegram_bot_id = ?`,
};

export default class {
    #bot;
    #message;

    constructor ( bot ) {
        this.#bot = bot;
    }

    // properties
    get message () {
        return this.#message;
    }

    // public
    async init () {
        var res;

        res = await this.#bot.dbh.selectRow( SQL.getStartMessage, [ this.id ] );
        if ( !res.ok ) return res;

        this.#message = await this.messages.get( res.data.telesgram_message_id );

        if ( !this.#message ) return result( [ 500, `Unable to load start message` ] );

        return result( 200 );
    }
}
