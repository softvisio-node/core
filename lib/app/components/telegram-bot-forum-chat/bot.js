import sql from "#lib/sql";
import ForumChat from "./bot/forum-chat";

const SQL = {
    "getForumChat": sql`SELECT * FROM telegram_bot_forum_chat WHERE telegram_bot_id = ?`.prepare(),
};

export default Super =>
    class extends Super {
        #forumChat;

        // properties
        get forumChat () {
            return this.#forumChat;
        }

        // pubjic
        async init () {
            var res;

            res = await super.init();
            if ( !res.ok ) return res;

            res = await this.dbh.selectRow( SQL.getForumChat, [ this.id ] );
            if ( !res.ok ) return res;

            this.#forumChat = new ForumChat( this, res.data );

            return result( 200 );
        }
    };
