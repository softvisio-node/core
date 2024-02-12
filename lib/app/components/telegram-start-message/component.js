import sql from "#lib/sql";
import Bot from "./bot.js";
import TelegramBotMessage from "#lib/app/components/telegram/bot/message";

const SQL = {
    "createStartMessage": sql`INSERT INTO telegram_bot_start_message ( telegram_bot_id, telegram_bot_message_id ) VALUES ( ?, ? )`,
};

export default Super =>
    class extends Super {

        // protected
        get _Bot () {
            return Bot( super._Bot );
        }

        async _init () {
            var res;

            res = await super._init();
            if ( !res.ok ) return res;

            // init db
            res = await this.app.dbh.schema.migrate( new URL( "db", import.meta.url ) );
            if ( !res.ok ) return res;

            return result( 200 );
        }

        async _createBot ( dbh, id, options ) {
            var res;

            const message = new TelegramBotMessage( { id } );

            res = await message.save( { dbh } );
            if ( !res.ok ) return res;

            res = await this.dbh.do( SQL.createStartMessage, ( id, message.id ) );

            return res;
        }
    };
