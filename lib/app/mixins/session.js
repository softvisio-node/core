const { mixin } = require( "../../mixins" );
const sql = require( "../../sql" );
const { TOKEN_TYPE_SESSION } = require( "../../const" );

module.exports = mixin( ( Super ) =>

/** class: Session
         *
         */
    class extends Super {
            #api;
            #dbh;

            constructor ( app, api, options ) {
                super( app, api, options );

                this.#api = api;
                this.#dbh = options.dbh;
            }

            /** method: API_signout
             * summary: Signout user, remove user session.
             * permissions: "@"
             */
            async API_signout ( auth ) {
                if ( auth.getTokenType() !== TOKEN_TYPE_SESSION ) return 404;

                return await this.#api.removeUserSession( auth.getTokenId() );
            }

            /** method: API_signin
             * summary: Signout user, remove user session.
             * permissions:
             * skipParamsValidation: true
             * params:
             *   - name: token
             *     schema:
             *       type: string
             */
            async API_signin ( auth, credentials ) {

                // authenticate user / password
                if ( credentials ) {

                    // lowercase username
                    credentials.username = credentials.username.toLowerCase();

                    // TODO authenticate
                    const userId = 1;

                    // create user session
                    const session = await this.#api.createUserSession( userId );

                    // unable to create session
                    if ( !session.isOk() ) return session;
	
                    const user = await this.#dbh.selectRow( sql`SELECT "id", "email", "gravatar", "locale" FROM "user" WHERE "id" = ?`, [userId] );

                    return [
                        200,
                        {
                            "token": session.data.token,
                            "is_authenticated": true,
                            "user_id": session.data.userId,
                            "user_name": session.data.userName,
                            "permissions": session.data.permissions,
                            "avatar": this._getAvatar( user ),
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
                    const user = await this.#dbh.selectRow( sql`SELECT "id", "email", "gravatar", "locale" FROM "user" WHERE "id" = ?`, [auth.userId] );

                    return [
                        200,
                        {
                            "is_authenticated": true,
                            "user_id": auth.userId,
                            "user_name": auth.userName,
                            "permissions": auth.permissions,
                            "avatar": this._getAvatar( user ),
                            "settings": this._getAppSettings( auth ),
                        },
                    ];
                }
            }

            _getAppSettings ( auth ) {
                return {};
            }

            // TODO
            _getAvatar ( user ) {}
    } );
