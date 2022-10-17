import mixins from "#lib/mixins";
import sql from "#lib/sql";
import constants from "#lib/app/constants";

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

    "checkEmailAvailable": sql`SELECT EXISTS ( SELECT FROM "user" WHERE email = ? ) AS exists`.prepare(),

    "setTelegramUsername": sql`UPDATE "user" SET telegram_username = ? WHERE id = ? AND NOT EXISTS ( SELECT FROM "user" WHERE telegram_username = ? )`.prepare(),
};

export default Super =>
    class extends mixins( Super ) {
        async API_getAccount ( ctx ) {
            const res = await this.dbh.selectRow( QUERIES.getAccount, [ctx.user.id] );

            if ( !res.ok ) return res;

            res.data.telegram_bot_username = await this.api.backend.notifications.getTelegramBotUsername();

            return res;
        }

        async API_setPassword ( ctx, password ) {
            const res = await this.api.setUserPassword( ctx.user.id, password );

            if ( res.ok ) this.api.backend.notifications.sendNotification( "security", ctx.user.id, "Password changed", "Your password was changed." );

            return res;
        }

        async API_sendEmailChangeToken ( ctx, email ) {
            var res = await this.dbh.selectRow( QUERIES.checkEmailAvailable, [email] );
            if ( !res.ok ) return res;
            if ( res.data.exists ) return result( [400, `Email address is already used`] );

            const token = await this.api.createUserActionToken( ctx.user.id, constants.tokenTypeEmailChange, { "data": { email } } );
            if ( !token.ok ) return token;

            const text = `
Use the following confirmation token to change your email address on ${this.api.config.frontendUrl}:

${token.data.token}

This token is valid till ${token.data.expires.toISOString()}.

If you received this email by mistake just ignore it.
`;

            return this.api.backend.notifications.sendEmail( email, "Email address change", text );
        }

        async API_setEmailByToken ( ctx, token ) {
            const res = await this.dbh.begin( async dbh => {
                const res = await this.api.activateUserActionToken( token, constants.tokenTypeEmailChange, { "userId": ctx.user.id, dbh } );
                if ( !res.ok ) throw res;

                const res1 = await this.api.setUserEmail( ctx.user.id, res.data.email, { dbh } );
                if ( !res1.ok ) throw res;

                return res;
            } );

            if ( res.ok ) {
                this.api.backend.notifications.sendNotification(
                    "security",
                    ctx.user.id,
                    "Email changed",
                    `Your email address was changed.

New email address: ${res.data.email}
`
                );
            }

            return res;
        }

        async API_setTelegramUsername ( ctx, username ) {
            if ( username ) {
                username = username.toLowerCase();

                const isValid = this.api.validate.validateTelegramUsername( username );

                if ( !isValid.ok ) return isValid;
            }
            else {
                username = null;
            }

            const res = await this.dbh.do( QUERIES.setTelegramUsername, [username, ctx.user.id, username] );

            if ( !res.meta.rows ) return result( [500, `Unable to change telegram username`] );

            if ( res.ok ) {
                this.api.backend.notifications.sendNotification(
                    "security",
                    ctx.user.id,
                    "Telegram username changed",
                    `Your telegram username was changed.

New telegram username: ${username}.
`
                );
            }

            return res;
        }

        async API_setLocale ( ctx, locale ) {
            return this.api.setUserLocale( ctx.user.id, locale );
        }

        async API_delete ( ctx, userId ) {
            return this.api.deleteUser( ctx.user.id );
        }

        async API_getSessions ( ctx ) {
            return this.api.getUserSessions( ctx.user.id, { "currentSessionId": ctx.token.id } );
        }

        async API_signoutSession ( ctx, sessionId ) {
            return await this.api.deleteUserSession( sessionId, { "userId": ctx.user.id } );
        }

        async API_signoutAllSessions ( ctx ) {
            return this.api.deleteUserSessions( ctx.user.id, { "excludeSessionId": ctx.token.id } );
        }
    };
