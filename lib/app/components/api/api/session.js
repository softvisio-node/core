import mixins from "#lib/mixins";
import constants from "#lib/app/constants";
import env from "#lib/env";
import sql from "#lib/sql";

const QUERIES = {
    "getUser": sql`SELECT id FROM "user" WHERE email = ?`.prepare(),
};

export default Super =>
    class extends mixins( Super ) {
        #settings;

        async API_checkAuthorization ( ctx ) {
            return result( 200, {
                "auth": ctx,
                "settings": await this.#getAppSettings( ctx ),
            } );
        }

        async API_signin ( ctx, { email, password, "oauth_provider": oauthProvider, "oauth_code": oauthCode, "oauth_redirect_uri": oauthRedirectUri } ) {
            var auth;

            if ( oauthProvider ) {
                auth = await this.api.authenticateUserOauth( oauthProvider, oauthCode, oauthRedirectUri );
            }
            else {
                auth = await this.api.authenticateUserCredentials( email, password );
            }

            // not authenticated
            if ( !auth ) return result( 401 );

            // create user session
            const session = await this.api.createUserSession( auth.user.id, {
                "hostname": ctx.hostname,
                "remoteAddress": ctx.remoteAddress + "",
                "userAgent": ctx.userAgent,
            } );

            // unable to create session
            if ( !session.ok ) return session;

            this._sendNewSigninNotification( auth.user.id, session.data );

            return result( 200, {
                auth,
                "settings": await this.#getAppSettings( auth ),
                "token": session.data.token,
            } );
        }

        async API_authorize ( ctx, { password, "oauth_provider": oauthProvider, "oauth_code": oauthCode, "oauth_redirect_uri": oauthRedirectUri } = {} ) {
            if ( !ctx.isUserSessionToken ) return result( 400 );

            var auth;

            if ( oauthProvider ) {
                auth = await this.api.authenticateUserOauth( oauthProvider, oauthCode, oauthRedirectUri );

                // oauth user email doesn't match current user email
                if ( auth && auth.email !== ctx.email ) return result( 401 );
            }
            else {
                auth = await this.api.authenticateUserCredentials( ctx.email, password );
            }

            // not authenticated
            if ( !auth ) return result( 401 );

            return this.api.updateSession( ctx.id, ctx.remoteAddress + "", ctx.userAgent );
        }

        async API_signout ( ctx ) {
            if ( ctx.type !== constants.tokenTypeUserSession ) return result( 404 );

            return await this.api.deleteUserSession( ctx.id, { "userId": ctx.userId } );
        }

        async API_signup ( ctx, email, fields ) {

            // signup is disabled
            if ( !this.api.config.signupEnabled ) return result( 400 );

            fields ||= {};

            delete fields.roles;

            fields.enabled = this.api.config.newUserEnabled;

            var res;

            // oauth
            if ( typeof email === "object" ) {
                res = await this.api.createUserOauth( email.oauth_provider, email.oauth_code, email.oauth_redirect_uri, fields );
            }

            // email
            else {
                res = await this.api.createUser( email, fields );
            }

            if ( res.ok ) {

                // sign in if user is enabled
                if ( res.data.enabled ) {
                    return this.API_signin( ctx, {
                        "email": res.data.email,
                        "password": res.data.password,
                    } );
                }
                else {
                    return result( [200, "You were registered"] );
                }
            }
            else {
                return res;
            }
        }

        async API_sendConfirmationEmail ( ctx ) {
            const token = await this.api.createUserActionToken( ctx.userId, constants.tokenTypeEmailConfirmation );

            if ( !token.ok ) return token;

            return this._sendConfirmationEmail( token.data.email, token );
        }

        async API_confirmEmailByToken ( ctx, token ) {
            return this.api.activateUserActionToken( token, constants.tokenTypeEmailConfirmation );
        }

        async API_sendPasswordRecoveryEmail ( ctx, email ) {
            const user = await this.dbh.selectRow( QUERIES.getUser, [email.toLowerCase()] );
            if ( !user.ok ) return user;
            if ( !user.data ) return result( [404, `User not found`] );

            const token = await this.api.createUserActionToken( user.data.id, constants.tokenTypePasswordReset );
            if ( !token.ok ) return token;

            return this._sendPasswordRecoveryEmail( email, token );
        }

        async API_setPasswordByToken ( ctx, token, password ) {
            return this.dbh.begin( async dbh => {
                const res = await this.api.activateUserActionToken( token, constants.tokenTypePasswordReset, { dbh } );
                if ( !res.ok ) throw res;

                const res1 = await this.api.setUserPassword( ctx.userId, password, { dbh } );
                if ( !res1.ok ) throw res;

                return res1;
            } );
        }

        async API_registerPushNotificationsToken ( ctx, token ) {
            return this.app.notifications.registerPushNotificationsToken( token, ctx.userId );
        }

        // private
        async _sendConfirmationEmail ( email, token ) {
            const url = `${this.api.config.frontendUrl}#/confirm-email/${token.data.token}`,
                text = `
Use the following link to confirm your email on ${this.api.config.frontendUrl}:

${url}

This link is valid till ${token.data.expires.toISOString()}.

If you received this email by mistake just ignore it.
`;

            return this.app.notifications.sendEmail( email, "Confirm your email", text );
        }

        async _sendPasswordRecoveryEmail ( email, token ) {
            const url = `${this.api.config.frontendUrl}#/reset-password/${token.data.token}`,
                text = `
Use the following link to reset your password on ${this.api.config.frontendUrl}.

${url}

This link is valid till ${token.data.expires.toISOString()}.

If you didn't ask for password reset and received this email by mistake just ignore it.
`;

            return this.app.notifications.sendEmail( email, "Password reset link", text );
        }

        async _sendNewSigninNotification ( userId, { userAgent, remoteAddress } ) {
            return this.app.notifications.sendNotification(
                "security",
                userId,
                "New sign in",
                `You just signed in on the new device.

IP address: ${remoteAddress}

Device: ${userAgent.device || "-"}

Platform: ${userAgent.os || "-"}

Browser: ${userAgent.browserName || "-"}

User agent: ${userAgent.userAgent || "-"}

If it was not you, please, change your password and remove this session from your account sessions.
`
            );
        }

        async _getAppSettings ( ctx ) {
            return {};
        }

        // private
        async #getAppSettings ( ctx ) {
            if ( !this.#settings ) {
                this.#settings = {
                    "backend_mode": env.mode,
                    "backend_git_id": await env.getGitId(),

                    "locales": this.api.config.locales,
                    "default_locale": this.api.config.defaultLocale,
                    "currency": this.api.config.currency,

                    "passwordsStrength": this.api.config.passwordsStrength,

                    "signup_enabled": this.api.config.signupEnabled,
                    "push_notifications_supported": this.app.notifications.pushEnabled,

                    "oauth_google_client_id": this.api.config.oauth?.google?.clientId,
                    "oauth_facebook_client_id": this.api.config.oauth?.facebook?.clientId,
                    "oauth_github_client_id": this.api.config.oauth?.github?.clientId,
                };
            }

            return {
                ...( ( await this._getAppSettings( ctx ) ) || {} ),
                ...this.#settings,
            };
        }
    };
