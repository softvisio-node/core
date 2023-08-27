import constants from "#lib/app/constants";
import env from "#lib/env";
import sql from "#lib/sql";

const SQL = {
    "getUser": sql`SELECT id FROM "user" WHERE email = ?`.prepare(),
};

export default Super =>
    class extends Super {
        #settings;

        async API_initSession ( ctx, { locale, locales } = {} ) {
            var permissions;

            if ( ctx.isAuthenticated ) {
                permissions = await this.app.acl.getAclUserPermissions( constants.defaultAclId, ctx.user.id );

                // error get ACL user permissions
                if ( permissions === false ) return result( [500, `Unable to get ACL user permissions`] );
            }
            else {
                permissions = null;
            }

            return result( 200, {
                "user": ctx.user,
                permissions,
                "settings": await this.#getAppSettings(),
                "locale": this.app.locales.getBackendLocale( ctx, locale, locales ),
            } );
        }

        async API_signIn ( ctx, { email, password, "oauth_provider": oauthProvider, "oauth_code": oauthCode, "oauth_redirect_uri": oauthRedirectUri } ) {
            var user;

            if ( oauthProvider ) {
                user = await this.api.users.authenticateUserOauth( oauthProvider, oauthCode, oauthRedirectUri );
            }
            else {
                user = await this.api.users.authenticateUserPassword( email, password );
            }

            // not authenticated
            if ( !user ) return result( 401 );

            // create user session
            const session = await this.api.sessions.createSession( user.id, {
                "hostname": ctx.hostname,
                "remoteAddress": ctx.remoteAddress + "",
                "userAgent": ctx.userAgent,
            } );

            // unable to create session
            if ( !session.ok ) return session;

            this._sendNewSigninNotification( user.id, session.data );

            return result( 200, {
                "token": session.data.token,
            } );
        }

        async API_authorize ( ctx, { password, "oauth_provider": oauthProvider, "oauth_code": oauthCode, "oauth_redirect_uri": oauthRedirectUri } = {} ) {
            if ( !ctx.token.isUserSessionToken ) return result( 400 );

            var user;

            if ( oauthProvider ) {
                user = await this.api.users.authenticateUserOauth( oauthProvider, oauthCode, oauthRedirectUri );

                // oauth user email doesn't match current user email
                if ( user && user.email !== ctx.user.email ) return result( 401 );
            }
            else {
                user = await this.api.users.authenticateUserPassword( ctx.user.email, password );
            }

            // not authenticated
            if ( !user ) return result( 401 );

            return this.api.sessions.updateSession( ctx.token.id, ctx.remoteAddress + "", ctx.userAgent );
        }

        async API_signOut ( ctx ) {
            if ( !ctx.token.isUserSessionToken ) return result( 404 );

            return await this.api.sessions.deleteSession( ctx.token.id, { "userId": ctx.user.id } );
        }

        async API_signUp ( ctx, email, fields ) {

            // signup is disabled
            if ( !this.api.config.signupEnabled ) return result( 400 );

            var res;

            // oauth
            if ( typeof email === "object" ) {
                res = await this.api.users.createUserOauth( email.oauth_provider, email.oauth_code, email.oauth_redirect_uri, fields );
            }

            // email
            else {
                res = await this.api.users.createUser( email, fields );
            }

            if ( res.ok ) {

                // sign in if user is enabled
                if ( res.data.enabled ) {
                    return this.API_signIn( ctx, {
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
            const token = await this.app.actionTokens.createActionToken( ctx.user.id, constants.tokenTypeEmailConfirmation );

            if ( !token.ok ) return token;

            return this._sendConfirmationEmail( token.data.email, token );
        }

        async API_confirmEmailByToken ( ctx, token ) {
            return this.app.actionTokens.activateActionToken( token, constants.tokenTypeEmailConfirmation );
        }

        async API_sendPasswordRecoveryEmail ( ctx, email ) {
            const user = await this.dbh.selectRow( SQL.getUser, [email.toLowerCase()] );
            if ( !user.ok ) return user;
            if ( !user.data ) return result( [404, `User not found`] );

            const token = await this.app.actionTokens.createActionToken( user.data.id, constants.tokenTypePasswordReset );
            if ( !token.ok ) return token;

            return this._sendPasswordRecoveryEmail( email, token );
        }

        async API_setPasswordByToken ( ctx, token, password ) {
            return this.dbh.begin( async dbh => {
                const res = await this.app.actionTokens.activateActionToken( token, constants.tokenTypePasswordReset, { dbh } );
                if ( !res.ok ) throw res;

                const res1 = await this.api.users.setUserPassword( ctx.user.id, password, { dbh } );
                if ( !res1.ok ) throw res;

                return res1;
            } );
        }

        async API_registerPushNotificationsToken ( ctx, token ) {
            return this.app.notifications.registerPushNotificationsToken( token, ctx.user.id );
        }

        // protected
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
            const locale = this.app.components.get( "api" ).locale;

            return this.app.notifications.sendNotification(
                "security",
                userId,
                locale.l10nt( locale => locale.l10n( "New device" ) ),
                locale.l10nt( locale =>
                    locale.l10n( msgid`You just signed in on the new device.

IP address: ${remoteAddress}

Device: ${userAgent.device || "-"}

Platform: ${userAgent.os || "-"}

Browser: ${userAgent.browserName || "-"}

User agent: ${userAgent.userAgent || "-"}

If it was not you, please, change your password and remove this session from your account sessions.
` ) )
            );
        }

        async _getAppSettings () {
            return {};
        }

        // private
        async #getAppSettings () {
            if ( !this.#settings ) {
                this.#settings = {
                    "backend_mode": env.mode,
                    "backend_git_id": await env.getGitId(),

                    "locales": this.app.locales,

                    "passwords_strength": this.api.config.passwordsStrength,
                    "signup_enabled": this.api.config.signupEnabled,
                    "internal_notifications_enabled": this.app.notifications.channels.internal.enabled,
                    "push_notifications_supported": this.app.notifications.channels.push.supported,
                    "push_notifications_prefix": this.app.notifications.pushNotificationsPrefix,

                    "oauth_google_client_id": this.api.config.oauth?.google?.clientId,
                    "oauth_github_client_id": this.api.config.oauth?.github?.clientId,
                    "oauth_facebook_client_id": this.api.config.oauth?.facebook?.clientId,
                };
            }

            return {
                ...( ( await this._getAppSettings() ) || {} ),
                ...this.#settings,
            };
        }
    };
