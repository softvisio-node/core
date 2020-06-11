const { mixin } = require( "../../mixins" );
const sql = require( "../../sql" );
const { TOKEN_TYPE_SESSION } = require( "../../const" );
const q = {
    "readProfile": sql`SELECT "name", "email", "email_confirmed", "telegram_name" FROM "user" WHERE "id" = ?`.prepare(),
};

module.exports = mixin( ( Super ) =>

/** class: Profile
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

            /** method: API_read
             * summary: Read authenticated used profile.
             * permissions: ["@"]
             */
            async API_read ( auth ) {
                return this.#dbh.selectRow( q.readProfile, [auth.userId] );
            }

            /** method: API_change_password
             * permissions: "@"
             * params:
             *   - name: password
             *     required: true
             *     schema:
             *       type: string
             */
            async API_change_password ( auth, password ) {
                return this.#api.setUserPassword( auth.userId, password );
            }
    } );
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 3:9           | no-unused-vars               | 'TOKEN_TYPE_SESSION' is assigned a value but never used.                       |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
