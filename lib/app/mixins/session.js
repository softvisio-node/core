const { mixin } = require( "../../mixins" );
const sql = require( "../../sql" );
const result = require( "../../result" );

const { AUTH_SESSION, AUTH_EMAIL_CONFIRM, AUTH_PASSWORD_RESET } = require( "../../const" );

const QUERIES = {
    "getGravatar": sql`SELECT "gravatar" FROM "user" WHERE "id" = ?`.prepare(),
};

module.exports = mixin( Super =>

/** class: Session
         * summary: Session.
         * permissions:
         *   - "*"
         */
    class extends Super {

        /** method: API_signin
             * summary: Signin user.
             * description: |-
             *   If `credentials` parameter is specified - will try to sign in user using username and password, otherwise will try to sign in user, using currently used api token.
             *
             *   **Returns**:
             *
             *   -   `200`: Sign in successfully.
             *
             *   -   `401`: Bad credentials.
             *
             *   -   `403`: Not authorized.
             *
             *   -   Any other status means bad request, internal or connection error. Refer to the response `reason` property for more information.
             * permissions: ["*"]
             * params:
             *   - name: credentials
             *     required: false
             *     schema:
             *       type: object
             *       properties:
             *         username: { type: string }
             *         password: { type: string }
             *       required:
             *         - username
             *         - password
             *       additionalProperties: false
             *   - name: signinPermissions
             *     summary: "Array of permissions. Only user, who has this permissions can sign in. If `null` permissions will not check."
             *     schema:
             *       anyOf:
             *         - type: "null"
             *         - type: array
             *           items:
             *             type: string
             */
        async API_signin ( auth, credentials, signinPermissions ) {

            // authenticate user / password
            if ( credentials ) {
                auth = await this.api.authenticate( [credentials.username, credentials.password] );

                // not authenticated
                if ( !auth.isAuthenticated ) return result( [401, "Not authenticated"] );

                // check allowed permissions
                if ( signinPermissions && !auth.hasPermissions( signinPermissions ) ) return result( [403, "You are not authorized to access this area."] );

                // get user data
                const user = await this.dbh.selectRow( QUERIES.getGravatar, [auth.userId] );

                // unable to get user data
                if ( !user.ok ) return user;

                // create user session
                const session = await this.api.createUserSession( auth.userId );

                // unable to create session
                if ( !session.ok ) return session;

                return result( 200, {
                    "token": session.data.token,
                    "user_id": auth.userId,
                    "username": auth.username,
                    "permissions": auth.permissions,
                    "avatar": this._getAvatar( user.data.gravatar ),
                    "settings": await this._getAppSettings( auth ),
                } );
            }

            // not authenticated
            else if ( !auth.isAuthenticated ) {
                return result( [401, "Not authenticated"], {
                    "settings": await this._getAppSettings(),
                } );
            }

            // authenticated by api token
            else {

                // check allowed permissions
                if ( signinPermissions && !auth.hasPermissions( signinPermissions ) ) return result( [403, "You are not authorized to access this area."] );

                // get user data
                const user = await this.dbh.selectRow( QUERIES.getGravatar, [auth.userId] );

                // unable to get user data
                if ( !user.ok ) return user;

                return result( 200, {
                    "user_id": auth.userId,
                    "username": auth.username,
                    "permissions": auth.permissions,
                    "avatar": this._getAvatar( user.data.gravatar ),
                    "settings": await this._getAppSettings( auth ),
                } );
            }
        }

        /** method: API_signout
             * summary: "Signout user, remove user session."
             * permissions: ["@"]
             */
        async API_signout ( auth ) {
            if ( auth.type !== AUTH_SESSION ) return result( 404 );

            return await this.api.removeUserSession( auth.id );
        }

        /** method: API_signup
             * summary: Signup user.
             * permissions: ["!"]
             * params:
             *   - name: fields
             *     required: true
             *     schema:
             *       type: object
             *       properties:
             *         username: { type: string }
             *         password: { type: string }
             *         email: { type: string }
             *         telegram_name: { type: string }
             *       required:
             *         - username
             */
        async API_signup ( auth, fields ) {
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

        /** method: API_send_confirmation_email
             * summary: Send confirmation email.
             * permissions: ["*"]
             * params:
             *   - name: user_id
             *     summary: User name or email.
             *     required: true
             *     schema:
             *       type: string
             */
        async API_send_confirmation_email ( auth, userId ) {
            var token = await this.api.createUserActionToken( userId, AUTH_EMAIL_CONFIRM );

            if ( !token.ok ) return token;

            await this._sendConfirmationEmail( token.data.email, token.data.token );

            return result( 200 );
        }

        /** method: API_confirm_email_by_token
             * summary: Confirm user email using email confirmation token.
             * permissions: ["*"]
             * params:
             *   - name: token
             *     summary: Email confirmation token.
             *     required: true
             *     schema:
             *       type: string
             */
        async API_confirm_email_by_token ( auth, token ) {
            return this.api.confirmUserActionTokenEmail( token );
        }

        /** method: API_send_password_reset_email
             * summary: Send password reset email.
             * permissions: ["*"]
             * params:
             *   - name: user_id
             *     summary: User name or email.
             *     required: true
             *     schema:
             *       type: string
             */
        async API_send_password_reset_email ( auth, userId ) {
            var token = await this.api.createUserActionToken( userId, AUTH_PASSWORD_RESET );

            if ( !token.ok ) return token;

            await this._sendPasswordResetEmail( token.data.email, token.data.token );

            return result( 200 );
        }

        /** method: API_set_password_by_token
             * summary: Set user password using password recovery token.
             * permissions: ["*"]
             * params:
             *   - name: token
             *     required: true
             *     schema:
             *       type: string
             *   - name: password
             *     required: true
             *     schema:
             *       type: string
             */
        async API_set_password_by_token ( auth, token, password ) {
            return this.api.setUserActionTokenPassword( token, password );
        }

        _sendConfirmationEmail ( email, token ) {
            var url = `${this.api.appSettings.app_url}#/confirm-email/${token}`,
                text = `
Use the following link to confirm your email:

${url}
`;

            return this.api.sendMail( {
                "to": email,
                "subject": "Confirm your email",
                text,
            } );
        }

        async _sendPasswordResetEmail ( email, token ) {
            var url = `${this.api.appSettings.app_url}#/reset-password/${token}`,
                text = `
Use the following link to reset your password:

${url}
`;

            return this.api.sendMail( {
                "to": email,
                "subject": "Reset Password",
                text,
            } );
        }

        async _getAppSettings ( auth ) {
            return {};
        }

        _getAvatar ( gravatar ) {
            if ( gravatar ) {
                return `https://s.gravatar.com/avatar/${gravatar}?d=${this.api.defaultGravatarImage}`;
            }
            else {
                return this.api.defaultGravatarUrl;
            }
        }
    } );
