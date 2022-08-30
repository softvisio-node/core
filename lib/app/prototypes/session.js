import Base from "./base.js";
import constants from "#lib/app/constants";
import env from "#lib/env";

export default class extends Base {
    async API_checkAuthentication ( ctx ) {
        return result( 200, {
            "auth": ctx,
            "settings": await this.#getAppSettings( ctx ),
        } );
    }

    async API_signin ( ctx, credentials ) {
        const auth = await this.api.authenticate( [credentials.username, credentials.password] );

        // backend is down
        if ( !auth ) return result( 503 );

        // not authenticated
        if ( !auth.isValid ) return result( 401 );

        // create user session
        const session = await this.api.createUserSession( auth.userId, {
            "userAgent": ctx.data.userAgent,
            "remoteAddress": ctx.data.remoteAddress + "",
        } );

        // unable to create session
        if ( !session.ok ) return session;

        return result( 200, {
            auth,
            "settings": await this.#getAppSettings( auth ),
            "key": session.data.key,
        } );
    }

    async API_signout ( ctx ) {
        if ( ctx.type !== constants.tokenTypeUserSession ) return result( 404 );

        return await this.api.deleteUserSession( ctx.id );
    }

    async API_signup ( ctx, fields ) {

        // signup is disabled
        if ( !this.app.config.signupEnabled ) return result( 400 );

        const { username, password } = fields;

        delete fields.username;
        delete fields.password;
        delete fields.enabled;
        delete fields.roles;

        const res = await this.api.createUser( username, password, this.app.config.newUserEnabled, null, fields );

        if ( res.ok ) {
            if ( this.app.config.newUserEnabled ) {
                return this.API_signin( ctx, { username, password } );
            }
            else {
                return result( [200, "You were registered"] );
            }
        }
        else {
            return res;
        }
    }

    async API_sendConfirmationEmail ( ctx, userId ) {
        var token = await this.api.createUserActionToken( userId, constants.tokenTypeEmailConfirmation );

        if ( !token.ok ) return token;

        return this._sendConfirmationEmail( token.data.email, token.data.token );
    }

    async API_confirmEmailByToken ( ctx, token ) {
        return this.api.confirmUserActionTokenEmail( token );
    }

    async API_sendPasswordResetEmail ( ctx, userId ) {
        var token = await this.api.createUserActionToken( userId, constants.tokenTypePasswordReset );

        if ( !token.ok ) return token;

        return this._sendPasswordResetEmail( token.data.email, token.data.token );
    }

    async API_setPasswordByToken ( ctx, token, password ) {
        return this.api.setUserActionTokenPassword( token, password );
    }

    async API_registerPushNotificationsToken ( ctx, token ) {
        return this.app.notifications.registerPushNotificationsToken( token, ctx.userId );
    }

    // private
    async _sendConfirmationEmail ( email, token ) {
        const url = `${process.env.APP_URL}#/confirm-email/${token}`,
            text = `
Use the following link to confirm your email on ${process.env.APP_URL}:

${url}

This link is valid for 24 hours, till ${new Date( Date.now() + 3600 * 1000 * 24 ).toISOString()}.

If you received this email by mistake just ignore it.
`;

        return this.app.notifications.sendEmail( email, "Confirm your email", text );
    }

    async _sendPasswordResetEmail ( email, token ) {
        const url = `${process.env.APP_URL}#/reset-password/${token}`,
            text = `
Use the following link to reset your password on ${process.env.APP_URL}.

${url}

This link is valid for 24 hours, till ${new Date( Date.now() + 3600 * 1000 * 24 ).toISOString()}.

If you didn't ask for password reset and received this email by mistake just ignore it.
`;

        return this.app.notifications.sendEmail( email, "Password reset link", text );
    }

    async _getAppSettings ( ctx ) {
        return {};
    }

    // private
    async #getAppSettings ( ctx ) {
        const settings = ( await this._getAppSettings( ctx ) ) || {};

        settings.backend_mode = env.mode;
        settings.git_id = await env.getGitId();
        settings.signup_enabled = this.app.config.signupEnabled;
        settings.push_notifications_supported = this.app.notifications.pushEnabled;

        return settings;
    }
}
