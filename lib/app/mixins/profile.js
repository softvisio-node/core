import sql from "#lib/sql";

const q = {
    "setEmail": sql`UPDATE "user" SET "email" = ? WHERE "id" = ?`.prepare(),
    "setTelegramUsername": sql`UPDATE "user" SET "telegram_name" = ? WHERE "id" = ?`.prepare(),
};

export default Super =>

    /** class: Profile
     * summary: Profile.
     * permissions: [user]
     */
    class extends ( Super || Object ) {

        /** method: API_read
         * summary: Read authenticated used profile.
         */
        async API_read ( ctx ) {
            return this.dbh.selectRow( q.readProfile, [ctx.userId] );
        }

        /** method: API_set_password
         * summary: Set user password.
         * params:
         *   - name: password
         *     required: true
         *     schema:
         *       type: string
         */
        async API_set_password ( ctx, password ) {
            return this.api.setUserPassword( ctx.userId, password );
        }

        /** method: API_set_email
         * summary: Set user email.
         * params:
         *   - name: email
         *     required: false
         *     schema:
         *       type: string
         */
        async API_set_email ( ctx, email ) {
            if ( email ) {
                email = email.toLowerCase();

                const isValid = this.api.validateEmail( email );

                if ( !isValid.ok ) return isValid();
            }
            else {
                email = null;
            }

            return this.dbh.do( q.setEmail, [email, ctx.userId] );
        }

        /** method: API_set_telegram_username
         * summary: Set user telegram name.
         * params:
         *   - name: username
         *     required: false
         *     schema:
         *       type: string
         */
        async API_set_telegram_username ( ctx, username ) {
            if ( username ) {
                username = username.toLowerCase();

                const isValid = this.api.validateTelegramUsername( username );

                if ( !isValid.ok ) return isValid();
            }
            else {
                username = null;
            }

            return this.dbh.do( q.setTelegramUsername, [username, ctx.userId] );
        }
    };
