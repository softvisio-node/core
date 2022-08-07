import Base from "./base.js";
import constants from "#lib/app/constants";

export default class extends Base {
    async API_checkAuthentication ( ctx ) {
        return result( 200, {
            "auth": ctx,
            "settings": await this._getAppSettings( ctx ),
        } );
    }

    async API_signin ( ctx, credentials, signinRoles ) {
        const auth = await this.api.authenticate( [credentials.username, credentials.password] );

        // backend is down
        if ( !auth ) return result( 503 );

        // not authenticated
        if ( !auth.isValid ) return result( 401 );

        // check allowed roles
        if ( signinRoles && !auth.hasRoles( signinRoles ) ) return result( 403 );

        // create user session
        const session = await this.api.createUserSession( auth.userId );

        // unable to create session
        if ( !session.ok ) return session;

        return result( 200, {
            auth,
            "settings": await this._getAppSettings( auth ),
            "token": session.data.token,
        } );
    }

    async API_signout ( ctx ) {
        if ( ctx.type !== constants.tokenTypeUserSession ) return result( 404 );

        return await this.api.deleteUserSession( ctx.id );
    }

    async API_signup ( ctx, fields ) {
        var { username, password } = fields;

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

        await this._sendConfirmationEmail( token.data.email, token.data.token );

        return result( 200 );
    }

    async API_confirmEmailByToken ( ctx, token ) {
        return this.api.confirmUserActionTokenEmail( token );
    }

    async API_sendPasswordResetEmail ( ctx, userId ) {
        var token = await this.api.createUserActionToken( userId, constants.tokenTypePasswordReset );

        if ( !token.ok ) return token;

        await this._sendPasswordResetEmail( token.data.email, token.data.token );

        return result( 200 );
    }

    async API_setPasswordByToken ( ctx, token, password ) {
        return this.api.setUserActionTokenPassword( token, password );
    }

    // private
    async _sendConfirmationEmail ( email, token ) {
        const url = `${process.env.APP_SITE_URL}#/confirm-email/${token}`,
            text = `
Use the following link to confirm your email:

${url}

This link is valid for 24 hours, till ${new Date( Date.now() + 3600 * 1000 * 24 ).toISOString()}.
`;

        return this.app.notifications.sendEmail( {
            "to": email,
            "subject": "Confirm your email",
            text,
        } );
    }

    async _sendPasswordResetEmail ( email, token ) {
        const url = `${process.env.APP_SITE_URL}#/reset-password/${token}`,
            text = `
Use the following link to reset your password:

${url}

This link is valid for 24 hours, till ${new Date( Date.now() + 3600 * 1000 * 24 ).toISOString()}.
`;

        return this.app.notifications.sendEmail( {
            "to": email,
            "subject": "Reset Password",
            text,
        } );
    }

    async _getAppSettings ( ctx ) {
        return {};
    }
}
