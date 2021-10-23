import Base from "./base.js";

import CONST from "#lib/const";

export default class extends Base {
    async API_signin ( ctx, credentials, signinPermissions ) {

        // authenticate user / password
        if ( credentials ) {
            const auth = await this.api.authenticate( [credentials.username, credentials.password] );

            // not authenticated
            if ( !auth.isAuthenticated ) return result( [401, "Not authenticated"] );

            // check allowed permissions
            if ( signinPermissions && !auth.hasPermissions( signinPermissions ) ) return result( [403, "You are not authorized to access this area."] );

            // create user session
            const session = await this.api.createUserSession( auth.userId );

            // unable to create session
            if ( !session.ok ) return session;

            return result( 200, {
                "token": session.data.token,
                auth,
                "settings": await this._getAppSettings( auth ),
            } );
        }

        // not authenticated
        else if ( !ctx.isAuthenticated ) {
            return result( [401, "Not authenticated"], {
                "settings": await this._getAppSettings( ctx ),
            } );
        }

        // authenticated by api token
        else {

            // check allowed permissions
            if ( signinPermissions && !ctx.hasPermissions( signinPermissions ) ) return result( [403, "You are not authorized to access this area."] );

            return result( 200, {
                "auth": ctx,
                "settings": await this._getAppSettings( ctx ),
            } );
        }
    }

    async API_signout ( ctx ) {
        if ( ctx.type !== CONST.AUTH_SESSION ) return result( 404 );

        return await this.api.removeUserSession( ctx.id );
    }

    async API_signup ( ctx, fields ) {
        var { username, password } = fields;

        delete fields.username;
        delete fields.password;
        delete fields.enabled;
        delete fields.permissions;

        var res = await this.api.createUser( username, password, this.api.newUserEnabled, null, fields );

        if ( res.ok ) {
            return result( [200, "You were registered."] );
        }
        else {
            return res;
        }
    }

    async API_sendConfirmationEmail ( ctx, userId ) {
        var token = await this.api.createUserActionToken( userId, CONST.AUTH_EMAIL_CONFIRM );

        if ( !token.ok ) return token;

        await this._sendConfirmationEmail( token.data.email, token.data.token );

        return result( 200 );
    }

    async API_confirmEmailByToken ( ctx, token ) {
        return this.api.confirmUserActionTokenEmail( token );
    }

    async API_sendPasswordResetEmail ( ctx, userId ) {
        var token = await this.api.createUserActionToken( userId, CONST.AUTH_PASSWORD_RESET );

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
            body = `
Use the following link to confirm your email:

${url}
`;

        return this.app.notifications.sendEmail( {
            "to": email,
            "subject": "Confirm your email",
            body,
        } );
    }

    async _sendPasswordResetEmail ( email, token ) {
        const url = `${process.env.APP_SITE_URL}#/reset-password/${token}`,
            body = `
Use the following link to reset your password:

${url}
`;

        return this.app.notifications.sendEmail( {
            "to": email,
            "subject": "Reset Password",
            body,
        } );
    }

    async _getAppSettings ( ctx ) {
        return {};
    }
}
