const { mixin } = require( "../../mixins" );

module.exports = mixin( Super =>

/** class: ApiTokens
         * summary: User API access tokens management.
         * permissions:
         *   - '@'
         */
    class extends Super {
            #api;
            #dbh;

            constructor ( app, api, options ) {
                super( app, api, options );

                this.#api = api;
                this.#dbh = options.dbh;
            }

            /** method: API_read
             * summary: Read api tokens.
             * params:
             *   - name: options
             *     schema:
             *       type: object
             */
            async API_read ( auth, options = {} ) {
                return this.#api.getUserTokens( auth.userId, options );
            }

            /** method: API_create
             * summary: Generate new API token.
             * params:
             *   - name: name
             *     required: true
             *     schema:
             *       type: string
             */
            async API_create ( auth, name ) {
                return await this.#api.createUserToken( auth.userId, name, true, {} );
            }

            /** method: API_delete
             * summary: Remove API token.
             * params:
             *   - name: tokenId
             *     required: true
             *     schema:
             *       type: string
             */
            async API_delete ( auth, tokenId ) {
                const token = await this.#api.getUserToken( tokenId );

                if ( !token ) return token;

                if ( token.data.user_id !== auth.userId ) return 404;

                return this.#api.removeUserToken( tokenId );
            }

            /** method: API_set_enabled
             * summary: Set API token enabled.
             * params:
             *   - name: tokenId
             *     required: true
             *     schema:
             *       type: string
             *   - name: enabled
             *     required: true
             *     schema:
             *       type: boolean
             */
            async API_set_enabled ( auth, tokenId, enabled ) {
                const token = await this.#api.getUserToken( tokenId );

                if ( !token ) return token;

                if ( token.data.user_id !== auth.userId ) return 404;

                return this.#api.setUserTokenEnabled( tokenId, enabled );
            }
    } );
