const { mixin } = require( "../../mixins" );
const sql = require( "../../sql" );
const { TOKEN_TYPE_SESSION, TOKEN_TYPE_PASSWORD_RECOVER } = require( "../../const" );
const q = {
    "getGravatar": sql`SELECT "gravatar" FROM "user" WHERE "id" = ?`.prepare(),
};

module.exports = mixin( ( Super ) =>

/** class: Session
         * summary: Session.
         * permissions: ["*"]
         */
    class extends Super {
            #api;
            #dbh;

            constructor ( app, api, options ) {
                super( app, api, options );

                this.#api = api;
                this.#dbh = options.dbh;
            }

            /** method: API_signin
             * summary: Signout user, remove user session.
             * permissions: ["*"]
             * params:
             *   - name: credentials
             *     required: false
             *     schema:
             *       type: object
             *       properties:
             *         username: {type: string}
             *         password: {type: string}
             *       required: [username, password]
             *       additionalProperties: false
             */
            async API_signin ( auth, credentials ) {

                // authenticate user / password
                if ( credentials ) {
                    auth = await this.#api.authenticate( [credentials.username, credentials.password] );

                    // not authenticated
                    if ( !auth.isAuthenticated ) return 401;

                    // create user session
                    const session = await this.#api.createUserSession( auth.userId );

                    // unable to create session
                    if ( !session.isOk() ) return session;

                    const user = await this.#dbh.selectRow( q.getGravatar, [auth.userId] );

                    if ( !user.isOk() ) return user;

                    return [
                        200,
                        {
                            "token": session.data.token,
                            "is_authenticated": true,
                            "user_id": auth.userId,
                            "user_name": auth.userName,
                            "permissions": auth.permissions,
                            "avatar": this._getAvatar( user.data.gravatar ),
                            "settings": this._getAppSettings( auth ),
                        },
                    ];
                }

                // not authenticated
                else if ( !auth.isAuthenticated ) {
                    return [
                        200,
                        {
                            "is_authenticated": false,
                            "settings": this._getAppSettings(),
                        },
                    ];
                }

                // authenticated
                else {
                    const user = await this.#dbh.selectRow( q.getGravatar, [auth.userId] );

                    if ( !user.isOk() ) return user;

                    return [
                        200,
                        {
                            "is_authenticated": true,
                            "user_id": auth.userId,
                            "user_name": auth.userName,
                            "permissions": auth.permissions,
                            "avatar": this._getAvatar( user.data.gravatar ),
                            "settings": this._getAppSettings( auth ),
                        },
                    ];
                }
            }

            /** method: API_signout
             * summary: Signout user, remove user session.
             * permissions: ["@"]
             */
            async API_signout ( auth ) {
                if ( auth.getTokenType() !== TOKEN_TYPE_SESSION ) return 404;

                return await this.#api.removeUserSession( auth.getTokenId() );
            }

            /** method: API_signup
             * summary: SignUp user.
             * permissions: ["!"]
             * params:
             *   - name: fields
             *     required: true
             *     schema:
             *       type: object
             *       properties:
             *         username: {type: string}
             *         password: {type: string}
             *         email: {type: string}
             *         telegram_name: {type: string}
             *       required: ["username"]
             */
            async API_signup ( auth, fields ) {
                var { username, password } = fields;

                delete fields.username;
                delete fields.password;
                delete fields.enabled;
                delete fields.permissions;

                if ( this.#api.userNameIsEmail ) fields.email = username;

                return this.#api.createUser( username, password, this.#api.newUserEnabled, this.#api.newUserPermissions, fields );
            }

            /** method: API_confirm_email
             * summary: Confirm user email using email token.
             * permissions: ["*"]
             * params:
             *   - name: token
             *     summary: Email confirmation token.
             *     required: true
             *     schema:
             *       type: string
             */
            async API_confirm_email ( auth, token ) {
                return this.#api.confirmUserActionTokenEmail( token );
            }

            /** method: API_recover_password
             * summary: Generate user password recovery token.
             * permissions: ["*"]
             * params:
             *   - name: user_id
             *     required: true
             *     schema:
             *       type: string
             */
            async API_recover_password ( auth, userId ) {
                var token = await this.#api.createUserActionToken( userId, TOKEN_TYPE_PASSWORD_RECOVER );

                if ( !token.isOk() ) return token;

                var res = this._sendPasswordRecoveryEmail( token.data.email, token.data.token );

                return res;
            }

            /** method: API_set_password
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
            async API_set_password ( auth, token, password ) {
                return this.#api.setUserActionTokenPassword( token, password );
            }

            // TODO
            _sendConfirmationEmail ( email, token ) {
                return;
            }

            // TODO
            _sendPasswordRecoveryEmail ( email, token ) {
                return;
            }

            _getAppSettings ( auth ) {
                return {};
            }

            _getAvatar ( gravatar ) {
                if ( gravatar ) {
                    return `https://s.gravatar.com/avatar/${gravatar}?d=${this.#api.defaultGravatarImage}`;
                }
                else {
                    return this.#api.defaultGravatarUrl;
                }
            }
    } );
