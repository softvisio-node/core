import sql from "#lib/sql";

const SQL = {
    "getStartMessage": sql`SELECT telegram_bot_message_id FROM telegram_bot_start_message WHERE telegram_bot_id = ?`,
};

export default Super =>
    class extends Super {
        #startMessageId;

        // pubjic
        async init () {
            var res;

            res = await super.init();
            if ( !res.ok ) return res;

            res = await this.dbh.selectRow( SQL.getStartMessage, [ this.id ] );
            if ( !res.ok ) return res;

            this.#startMessageId = res.data.telegram_bot_message_id;

            return result( 200 );
        }

        async getStartMessage () {
            return this.messages.getMessage( this.#startMessageId );
        }
    };
