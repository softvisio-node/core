const { mixin } = require( "../../mixins" );
const sql = require( "../../sql" );
const q = {
    "setEmail": sql`UPDATE "user" SET "email" = ? WHERE "id" = ?`.prepare(),
    "setTelegramUsername": sql`UPDATE "user" SET "telegram_name" = ? WHERE "id" = ?`.prepare(),
};

module.exports = mixin( ( Super ) =>

/** class: Profile
         * summary: Profile.
         * permissions: ["@"]
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
             */
            async API_read ( auth ) {
                return this.#dbh.selectRow( q.readProfile, [auth.userId] );
            }

            /** method: API_set_password
             * summary: Set user password.
             * params:
             *   - name: password
             *     required: true
             *     schema:
             *       type: string
             */
            async API_set_password ( auth, password ) {
                return this.#api.setUserPassword( auth.userId, password );
            }

            /** method: API_set_email
             * summary: Set user email.
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

                    if ( !isValid.ok ) return isValid();
                }
                else {
                    email = null;
                }

                return this.#dbh.do( q.setEmail, [email, auth.userId] );
            }

            /** method: API_set_telegram_username
             * summary: Set user telegram name.
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

                    if ( !isValid.ok ) return isValid();
                }
                else {
                    username = null;
                }

                return this.#dbh.do( q.setTelegramUsername, [username, auth.userId] );
            }
    } );
