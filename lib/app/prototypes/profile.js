import Base from "./base.js";
import sql from "#core/sql";

const q = {
    "setEmail": sql`UPDATE "user" SET "email" = ? WHERE "id" = ?`.prepare(),
    "setTelegramUsername": sql`UPDATE "user" SET "telegram_name" = ? WHERE "id" = ?`.prepare(),
};

export default class extends Base {
    async API_read ( ctx ) {
        return this.dbh.selectRow( q.readProfile, [ctx.userId] );
    }

    async API_set_password ( ctx, password ) {
        return this.api.setUserPassword( ctx.userId, password );
    }

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
}
