const { mixin } = require( "../../mixins" );

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
            API_signout ( auth ) {
                this.#api.removeUserSession();

                return 200;
            }
    } );
