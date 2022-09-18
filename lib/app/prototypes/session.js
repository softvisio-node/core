import Base from "./base.js";
import constants from "#lib/app/constants";
import env from "#lib/env";
import sql from "#lib/sql";

const QUERIES = {
    "getUser": sql`SELECT id FROM "user" WHERE email = ?`.prepare(),
};

export default class extends Base {
    #settings;

    async API_checkAuthorization ( ctx ) {
        return result( 200, {
            "auth": ctx,
            "settings": await this.#getAppSettings( ctx ),
        } );
    }

    async API_signin ( ctx, { email, password } ) {
        const auth = await this.api.authenticateUserCredentials( email, password );

        // not authenticated
        if ( !auth ) return result( 401 );

        // create user session
        const session = await this.api.createUserSession( auth.userId, {
            "remoteAddress": ctx.data.remoteAddress + "",
            "userAgent": ctx.data.userAgent,
        } );

        // unable to create session
        if ( !session.ok ) return session;

        this._sendNewSigninNotification( auth.userId, session.data );

        return result( 200, {
            auth,
            "settings": await this.#getAppSettings( auth ),
            "token": session.data.token,
        } );
    }

    async API_authorize ( ctx, password ) {
        if ( !ctx.isUserSessionToken ) return result( 400 );

        const auth = await this.api.authenticateUserCredentials( ctx.email, password );

        // not authenticated
        if ( !auth ) return result( 401 );

        return this.api.updateSession( ctx.id, ctx.data.remoteAddress + "", ctx.data.userAgent );
    }

    async API_signout ( ctx ) {
        if ( ctx.type !== constants.tokenTypeUserSession ) return result( 404 );

        return await this.api.deleteUserSession( ctx.id, { "userId": ctx.userId } );
    }

    async API_signup ( ctx, fields ) {

        // signup is disabled
        if ( !this.app.config.signupEnabled ) return result( 400 );

        const email = fields.email;
        delete fields.email;
        delete fields.roles;

        fields.enabled = this.app.config.newUserEnabled;

        const res = await this.api.createUser( email, fields );

        if ( res.ok ) {
            if ( this.app.config.newUserEnabled ) {
                return this.API_signin( ctx, { email, "password": fields.password } );
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
        const url = `${process.env.APP_URL}#/confirm-email/${token.data.token}`,
            text = `
Use the following link to confirm your email on ${process.env.APP_URL}:

${url}

This link is valid till ${token.data.expies.toISOString()}.

If you received this email by mistake just ignore it.
`;

        return this.app.notifications.sendEmail( email, "Confirm your email", text );
    }

    async _sendPasswordRecoveryEmail ( email, token ) {
        const url = `${process.env.APP_URL}#/reset-password/${token.data.token}`,
            text = `
Use the following link to reset your password on ${process.env.APP_URL}.

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

                "locales": [...this.app.config.locales],
                "default_locale": this.app.config.defaultLocale,
                "currency": this.app.config.currency,

                "signup_enabled": this.app.config.signupEnabled,
                "push_notifications_supported": this.app.notifications.pushEnabled,

                "signin_google_enabled": false,
                "signin_facebook_enabled": false,
                "signin_github_enabled": false,
            };
        }

        return {
            ...( ( await this._getAppSettings( ctx ) ) || {} ),
            ...this.#settings,
        };
    }
}
