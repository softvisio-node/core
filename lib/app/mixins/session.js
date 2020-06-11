const { mixin } = require( "../../mixins" );
const sql = require( "../../sql" );
const { TOKEN_TYPE_SESSION } = require( "../../const" );
const q = {
    "getGravatar": sql`SELECT "gravatar" FROM "user" WHERE "id" = ?`.prepare(),
};

module.exports = mixin( ( Super ) =>

/** class: Session
         *
         */
    class extends Super {

            // url encoded url or 404, mp, identicon, monsterid, wavatar, retro, robohash, blank
            // used if email is provided, but has no gravatar associated
            defaultGravatarImage = "identicon";

            // noname@softvisio.net, used if no user email is provided
            defaultGravatar = "https://s.gravatar.com/avatar/4732e01b487869e3e6d42c2720468036?d=identicon";

            #api;
            #dbh;

            constructor ( app, api, options ) {
                super( app, api, options );

                this.#api = api;
                this.#dbh = options.dbh;
            }

            /** method: API_signin
             * summary: Signout user, remove user session.
             * permissions:
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

                    // authenticate
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
             * permissions: "@"
             */
            async API_signout ( auth ) {
                if ( auth.getTokenType() !== TOKEN_TYPE_SESSION ) return 404;

                return await this.#api.removeUserSession( auth.getTokenId() );
            }

            _getAppSettings ( auth ) {
                return {};
            }

            _getAvatar ( gravatar ) {
                if ( gravatar ) {
                    return `https://s.gravatar.com/avatar/${gravatar}?d=${this.defaultGravatarImage}`;
                }
                else {
                    return this.defaultGravatar;
                }
            }
    } );
