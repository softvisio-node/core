import sql from "#lib/sql";
import Bot from "./bot.js";
import TelegramBotContact from "#lib/app/components/telegram/bot/contact";

const SQL = {
    "createContacts": sql`INSERT INTO telegram_bot_telegram_bot_contact ( telegram_bot_id, telegram_bot_contact_id ) VALUES ( ?, ? ) ON CONFLICT DO NOTHING`,
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

            const contact = await TelegramBotContact.new(
                {
                    "bot": { id },
                },
                { dbh }
            );

            res = await dbh.do( SQL.createContacts, [ id, contact.id ] );

            return res;
        }
    };
