import Base from "./base.js";
import sql from "#lib/sql";

const q = {
    "setEmail": sql`UPDATE "user" SET "email" = ? WHERE "id" = ?`.prepare(),
    "setTelegramUsername": sql`UPDATE "user" SET "telegram_username" = ? WHERE "id" = ?`.prepare(),
};

export default class extends Base {
    async API_setPassword ( ctx, password ) {
        const res = await this.api.setUserPassword( ctx.userId, password );

        if ( res.ok ) this.app.notifications.sendNotification( "security", ctx.userId, "Password changed", "Your password was changed." );

        return res;
    }

    async API_setEmail ( ctx, email ) {
        if ( email ) {
            email = email.toLowerCase();

            const isValid = this.api.validateEmail( email );

            if ( !isValid.ok ) return isValid();
        }
        else {
            email = null;
        }

        const res = await this.dbh.do( q.setEmail, [email, ctx.userId] );

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

        const res = await this.dbh.do( q.setTelegramUsername, [username, ctx.userId] );

        if ( res.ok ) this.app.notifications.sendNotification( "security", ctx.userId, "Telegram username changed", "Your telegram username was changed." );

        return res;
    }

    async API_deleteSessions ( ctx ) {
        return this.api.removeUserSessions( ctx.userId, { "except": ctx.id } );
    }
}
