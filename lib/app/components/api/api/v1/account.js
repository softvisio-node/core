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
            const res = await this.app.users.setUserPassword( ctx.user.id, password );

            if ( res.ok ) {
                this.#sendPasswordChangedNotification( ctx.user.id );
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

            return this.#sendEmailChangeToken( email, token, ctx.user.locale );
        }

        async API_setEmailByToken ( ctx, token, { password, "oauth_provider": oauthProvider, "oauth_code": oauthCode, "oauth_redirect_uri": oauthRedirectUri } = {} ) {
            var user, oldEmail, newEmail;

            const res = await this.dbh.begin( async dbh => {

                // activate tokem
                const res = await this.app.actionTokens.activateActionToken( token, constants.emailChangeToken.id, {
                    dbh,
                } );
                if ( !res.ok ) throw res;

                // get user
                user = await this.app.users.getUserById( res.data.user_id, { dbh } );
                if ( !user ) throw result( [404, `User not found`] );

                oldEmail = user.email;
                newEmail = res.data.data.email;

                let authUser;

                // auth
                if ( oauthProvider ) {
                    authUser = await this.api.users.authenticateUserOauth( oauthProvider, oauthCode, oauthRedirectUri, { dbh } );
                }
                else {
                    authUser = await this.api.users.authenticateUserPassword( oldEmail, password, { dbh } );
                }

                if ( !authUser || authUser.email !== user.email ) throw result( [404, `User not found`] );

                // set user emaul
                const res1 = await this.app.users.setUserEmail( user.id, newEmail, {
                    "emailConfirmad": true,
                    dbh,
                } );
                if ( !res1.ok ) throw res;

                return res;
            } );

            if ( res.ok ) {
                this.#sendEmailChangedNotification( user, oldEmail, newEmail );
            }

            return res;
        }

        async API_setLocale ( ctx, locale ) {
            return this.app.users.setUserLocale( ctx.user.id, locale );
        }

        async API_delete ( ctx, userId ) {
            return this.app.users.deleteUser( ctx.user.id );
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

        // private
        async #sendPasswordChangedNotification ( userId ) {
            return this.app.notifications.sendNotification(

                //
                "security",
                userId,
                this.app.templates.get( "api/password-changed/subject" ),
                this.app.templates.get( "api/password-changed/body" )
            );
        }

        async #sendEmailChangeToken ( email, token, userLocale ) {
            return this.app.notifications.sendEmail(
                email,
                this.app.templates.get( "api/email-change-token/subject" ).toString( {
                    "localeDomain": userLocale,
                } ),
                this.app.templates.get( "api/email-change-token/body" ).toString( {
                    "localeDomain": userLocale,
                    "data": {
                        email,
                        "url": `${this.api.config.frontendUrl}#/change-email?token=${token.data.token}`,
                        "tokenExpires": token.data.expires,
                    },
                } )
            );
        }

        async #sendEmailChangedNotification ( user, oldEmail, newEmail ) {
            const body = this.app.templates.get( "api/email-changed/body" ).clone( {
                "data": {
                    oldEmail,
                    newEmail,
                },
            } );

            this.app.notifications.sendEmail(
                oldEmail,
                this.app.templates.get( "api/email-changed/subject" ).toString( {
                    "localeDomain": user.locale,
                } ),
                body.toString( {
                    "localeDomain": user.locale,
                } )
            );

            this.app.notifications.sendNotification( "security", user.id, this.app.templates.get( "api/email-changed/subject" ), body );
        }
    };
