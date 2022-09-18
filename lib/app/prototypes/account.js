import Base from "./base.js";
import sql from "#lib/sql";

const QUERIES = {
    "getAccount": sql`
SELECT
    id,
    email,
    email_confirmed,
    telegram_username,
    telegram_connected
FROM
    "user"
WHERE
    id = ?
`.prepare(),

    "setTelegramUsername": sql`UPDATE "user" SET "telegram_username" = ? WHERE "id" = ?`.prepare(),
};

export default class extends Base {
    async API_getAccount ( ctx ) {
        return this.dbh.selectRow( QUERIES.getAccount, [ctx.userId] );
    }

    async API_setPassword ( ctx, password ) {
        const res = await this.api.setUserPassword( ctx.userId, password );

        if ( res.ok ) this.app.notifications.sendNotification( "security", ctx.userId, "Password changed", "Your password was changed." );

        return res;
    }

    async API_setEmail ( ctx, email ) {
        const res = await this.api.setUserEmail( ctx.userId, email );

        if ( res.ok ) this.app.notifications.sendNotification( "security", ctx.userId, "Email changed", "Your email address was changed." );

        return res;
    }

    async API_setTelegramUsername ( ctx, username ) {
        if ( username ) {
            username = username.toLowerCase();

            const isValid = this.api.validateTelegramUsername( username );

            if ( !isValid.ok ) return isValid();
        }
        else {
            username = null;
        }

        const res = await this.dbh.do( QUERIES.setTelegramUsername, [username, ctx.userId] );

        if ( res.ok ) this.app.notifications.sendNotification( "security", ctx.userId, "Telegram username changed", "Your telegram username was changed." );

        return res;
    }

    async API_setLocale ( ctx, locale ) {
        return this.api.setUserLocale( ctx.userId, locale );
    }

    async API_delete ( ctx, userId ) {
        return this.api.deleteUser( ctx.userId );
    }

    async API_getSessions ( ctx ) {
        return this.api.getUserSessions( ctx.userId, { "currentSessionId": ctx.id } );
    }

    async API_signoutSession ( ctx, sessionId ) {
        return await this.api.deleteUserSession( sessionId, { "userId": ctx.userId } );
    }

    async API_signoutAllSessions ( ctx ) {
        return this.api.deleteUserSessions( ctx.userId, { "excludeSessionId": ctx.id } );
    }
}
