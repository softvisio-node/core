import sql from "#lib/sql";
import Bot from "./bot.js";

const SQL = {
    "createForumChat": sql`INSERT INTO telegram_bot_forum_chat ( telegram_bot_id ) VALUES ( ? ) ON CONFLICT DO NOTHING`,
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

            res = await dbh.do( SQL.createForumChat, [ id ] );

            return res;
        }
    };
