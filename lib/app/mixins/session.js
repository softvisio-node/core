const { mixin } = require( "../../mixins" );
const { TOKEN_TYPE_SESSION } = require( "../../const" );

module.exports = mixin( ( Super ) =>

/** class: Session
         *
         */
    class extends Super {
            #api;

            constructor ( app, api, options ) {
                super( app, api, options );

                this.#api = api;
            }

            /** method: API_signout
             * summary: Signout user, remove user session.
             * permissions: "@"
             */
            async API_signout ( auth ) {
                if ( auth.getTokenType() !== TOKEN_TYPE_SESSION ) return 404;

                return await this.#api.removeUserSession( auth.getTokenId() );
            }
    } );
