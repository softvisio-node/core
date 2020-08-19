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
                return this.#api.getUserTokens( auth.userId );
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
                const res = await this.#api.createUserToken( auth.userId, name, true, {} );

                console.log( res );

                return res;
            }

            /** method: API_delete
             * summary: Remove API token.
             * params:
             *   - name: tokenId
             *     required: true
             *     schema:
             *       type: string
             */
            // XXX check auth
            async API_delete ( auth, tokenId ) {
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
            // XXX check auth
            async API_set_enabled ( auth, tokenId, enabled ) {
                return this.#api.setUserTokenEnabled( tokenId, enabled );
            }
    } );
