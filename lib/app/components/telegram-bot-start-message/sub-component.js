import Bot from "./bot.js";
import TelegramBotMessage from "#lib/app/components/telegram/bot/message";
import sql from "#lib/sql";

const SQL = {
    "createStartMessage": sql`INSERT INTO telegram_bot_start_message ( telegram_bot_id, telegram_bot_message_id ) VALUES ( ?, ? ) ON CONFLICT DO NOTHING`,
};

export default Super =>
    class extends Super {

        // protected
        _applySubConfig () {
            super._applySubConfig();

            this._mergeSubConfig( import.meta.url );
        }

        _applySubSchema ( schema ) {
            return this._mergeSubSchema( super._applySubSchema( schema ), import.meta.url );
        }

        _buildBot () {
            return Bot( super._buildBot() );
        }

        async _createBot ( dbh, id, options ) {
            var res;

            res = await super._createBot( dbh, id, options );
            if ( !res.ok ) return res;

            res = await TelegramBotMessage.create( dbh, id );
            if ( !res.ok ) return res;

            res = await dbh.do( SQL.createStartMessage, [ id, res.data.id ] );

            return res;
        }
    };
