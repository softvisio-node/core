import sql from "#lib/sql";
import constants from "#lib/app/constants";

const SQL = {
    "getAccount": sql`
SELECT
    id,
    email,
    email_confirmed
FROM
    "user"
WHERE
    id = ?
`.prepare(),

    "checkEmailAvailable": sql`SELECT EXISTS ( SELECT FROM "user" WHERE email = ? ) AS exists`.prepare(),
};

export default Super =>
    class extends Super {
        async API_getAccount ( ctx ) {
            return this.dbh.selectRow( SQL.getAccount, [ctx.user.id] );
        }

        async API_setPassword ( ctx, password ) {
            const res = await this.api.users.setUserPassword( ctx.user.id, password );

            if ( res.ok ) {
                this.app.notifications.sendNotification(

                    //
                    "security",
                    ctx.user.id,
                    this.app.locale.l10nt( locale => locale.l10n( "Password changed" ) ),
                    this.app.locale.l10nt( locale => locale.l10n( "Your password was just changed." ) )
                );
            }

            return res;
        }

        async API_sendEmailChangeToken ( ctx, email ) {
            var res = await this.dbh.selectRow( SQL.checkEmailAvailable, [email] );
            if ( !res.ok ) return res;
            if ( res.data.exists ) return result( [400, `Email address is already used`] );

            const token = await this.app.actionTokens.createActionToken( ctx.user.id, constants.emailChangeToken.id, {
                "length": constants.emailChangeToken.length,
                "maxAge": constants.emailChangeToken.maxAge,
                "data": { email },
            } );
            if ( !token.ok ) return token;

            const text = `
Use the following confirmation token to change your email address on ${this.api.config.frontendUrl}:

${token.data.token}

This token is valid till ${token.data.expires.toISOString()}.

If you received this email by mistake just ignore it.
`;

            return this.app.notifications.sendEmail( email, "Email address change", text );
        }

        async API_setEmailByToken ( ctx, token ) {
            const res = await this.dbh.begin( async dbh => {
                const res = await this.app.actionTokens.activateActionToken( token, constants.emailChangeToken.id, { "userId": ctx.user.id, dbh } );
                if ( !res.ok ) throw res;

                const res1 = await this.api.users.setUserEmail( ctx.user.id, res.data.email, { dbh } );
                if ( !res1.ok ) throw res;

                return res;
            } );

            if ( res.ok ) {
                this.app.notifications.sendNotification(
                    "security",
                    ctx.user.id,
                    this.app.locale.l10nt( locale => locale.l10n( "Email changed" ) ),
                    this.app.locale.l10nt( locale =>
                        locale.l10n( msgid`Your email address was changed.

New email address: ${res.data.email}
` ) )
                );
            }

            return res;
        }

        async API_setLocale ( ctx, locale ) {
            return this.api.users.setUserLocale( ctx.user.id, locale );
        }

        async API_delete ( ctx, userId ) {
            return this.api.users.deleteUser( ctx.user.id );
        }

        async API_getSessions ( ctx ) {
            return this.api.sessions.getSessions( ctx.user.id, { "currentSessionId": ctx.token.id } );
        }

        async API_signOutSession ( ctx, sessionId ) {
            return await this.api.sessions.deleteSession( sessionId, { "userId": ctx.user.id } );
        }

        async API_signOutAllSessions ( ctx ) {
            return this.api.sessions.deleteSessions( ctx.user.id, { "excludeSessionId": ctx.token.id } );
        }
    };
