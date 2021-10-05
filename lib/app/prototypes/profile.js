import Base from "./base.js";
import sql from "#lib/sql";

const q = {
    "setEmail": sql`UPDATE "user" SET "email" = ? WHERE "id" = ?`.prepare(),
    "setTelegramUsername": sql`UPDATE "user" SET "telegram_name" = ? WHERE "id" = ?`.prepare(),
};

export default class extends Base {
    async API_read ( ctx ) {
        return this.dbh.selectRow( q.readProfile, [ctx.userId] );
    }

    async API_setPassword ( ctx, password ) {
        return this.api.setUserPassword( ctx.userId, password );
    }

    async API_setEmail ( ctx, email ) {
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

    async API_setTelegramUsername ( ctx, username ) {
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

    async API_deleteSessions ( ctx ) {
        return this.api.removeUserSessions( ctx.userId, { "except": ctx.id } );
    }
}

// ----- SOURCE FILTER LOG BEGIN -----
//
// +----------+----------+--------------------------------------------------------------------------+
// | Severity |     Line | Desctiption                                                              |
// |==========+==========+==========================================================================|
// | ERROR    |    14:11 | @softvisio/camelcase, Identifier 'API_setPassword' is not in camel case. |
// |----------+----------+--------------------------------------------------------------------------|
// | ERROR    |    18:11 | @softvisio/camelcase, Identifier 'API_setEmail' is not in camel case.    |
// |----------+----------+--------------------------------------------------------------------------|
// | ERROR    |    33:11 | @softvisio/camelcase, Identifier 'API_setTelegramUsername' is not in     |
// |          |          | camel case.                                                              |
// |----------+----------+--------------------------------------------------------------------------|
// | ERROR    |    48:11 | @softvisio/camelcase, Identifier 'API_deleteSessions' is not in camel    |
// |          |          | case.                                                                    |
// +----------+----------+--------------------------------------------------------------------------+
//
// ----- SOURCE FILTER LOG END -----
