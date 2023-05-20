import Bot from "#lib/app/components/telegram/telegram/bot";
import sql from "#lib/sql";

const SQL = {
    "insertTelegramUser": sql`INSERT INTO telegram_user ( id, name ) VALUES ( ?, ? )`.prepare(),

    "deleteTelegramUser": sql`DELETE FROM telegram_user WHERE id = ?`.prepare(),
};

export default class extends Bot {

    // protected
    async _update ( update ) {
        this.sendMessage( update.chatId, `This is notifications bot. It doesn't support any additional commands.` );

        const telegramUserId = update.from?.id,
            telegramUsername = update.from?.username;

        if ( !telegramUserId ) return;

        // chat_member message
        if ( update.type === "my_chat_member" ) {

            // bot blocked
            if ( update.new_chat_member.status === "kicked" ) {
                await this.dbh.do( SQL.deleteTelegramUser, [telegramUserId] );
            }

            // bot restarted
            else if ( update.new_chat_member.status === "member" ) {
                await this.dbh.do( SQL.insertTelegramUser, [telegramUserId, telegramUsername] );

                this.sendMessage( telegramUserId, `You are subscribed to the notifications. This bot doesn't support any additional commands.` );
            }
        }
        else {
            const user = await this.api.cache.getUserByTelegramUserId( telegramUserId );

            if ( !user ) {
                await this.sendMessage( telegramUserId, `You are not authorized to use this bot. Please set your telegram username at the project notification settings and type "/start" again.` );
            }
            else {
                this.sendMessage( telegramUserId, `This is notifications bot. It doesn't support any additional commands.` );
            }
        }
    }
}
