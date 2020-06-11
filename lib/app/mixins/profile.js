const { mixin } = require( "../../mixins" );
const sql = require( "../../sql" );
const q = {
    "setEmail": sql`UPDATE "user" SET "email" = ? WHERE "id" = ?`.prepare(),
    "setTelegramUsername": sql`UPDATE "user" SET "telegram_name" = ? WHERE "id" = ?`.prepare(),
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

            /** method: API_set_email
             * permissions: "@"
             * params:
             *   - name: email
             *     required: false
             *     schema:
             *       type: string
             */
            async API_set_email ( auth, email ) {
                if ( email ) {
                    email = email.toLowerCase();

                    const isValid = this.#api.validateEmail( email );

                    if ( !isValid.isOk() ) return isValid();
                }
                else {
                    email = null;
                }

                return this.#dbh.do( q.setEmail, [email, auth.userId] );
            }

            /** method: API_set_telegram_username
             * permissions: "@"
             * params:
             *   - name: username
             *     required: false
             *     schema:
             *       type: string
             */
            async API_set_telegram_username ( auth, username ) {
                if ( username ) {
                    username = username.toLowerCase();

                    const isValid = this.#api.validateTelegramUsername( username );

                    if ( !isValid.isOk() ) return isValid();
                }
                else {
                    username = null;
                }

                return this.#dbh.do( q.setTelegramUsername, [username, auth.userId] );
            }
    } );
