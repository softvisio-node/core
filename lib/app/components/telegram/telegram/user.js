import sql from "#lib/sql";

const SQL = {
    "setPhone": sql`UPDATE `.prepare(),
};

export default class TelegramUser {
    #dbh;
    #userid;
    #telegramId;
    #isBot;
    #username;
    #firstName;
    #lastName;
    #phone;

    constructor ( dbh, fields ) {
        this.#dbh = dbh;

        this.#userid = fields.telegram_user_id;
        this.#telegramId = fields.telegram_id;
        this.#isBot = fields.is_bot;

        this.updateUserFields( fields );
    }

    // properties
    get dbh () {
        return this.#dbh;
    }

    get userid () {
        return this.#userid;
    }

    get telegramId () {
        return this.#telegramId;
    }

    get isBot () {
        return this.#isBot;
    }

    get username () {
        return this.#username;
    }

    get firstNmae () {
        return this.#firstName;
    }

    get lastName () {
        return this.#lastName;
    }

    get phone () {
        return this.#phone;
    }

    // public
    updateUserFields ( fields ) {
        if ( "username" in fields ) this.#username = fields.username;

        if ( "first_name" in fields ) this.#firstName = fields.first_name;

        if ( "last_name" in fields ) this.#lastName = fields.last_name;

        if ( "phone" in fields ) this.#phone = fields.phone;
    }

    // XXX
    async setTelegramUserFields ( fields ) {
        const update = new Map();

        for ( const field of ["username", "first_name", "last_name"] ) {
            if ( this[field] !== fields[field] ) update.set( field, fields[field] );
        }

        // no changes
        if ( !update.size ) return result( 200 );

        const res = await this.dbh.do( sql`UPDATE telegram_user`.SET( update ).sql`WHERE id = ${this.#userid}` );

        if ( !res.ok ) return res;

        // for ( const [field, value] of update.entries() ) {
        // this.#[field] = value;
        // }

        return result( 200 );
    }

    async setPhone ( phone ) {
        if ( phone === this.#phone ) return result( 200 );

        const res = await this.dbh.do( SQL.setPhone, [phone, this.#userid] );

        if ( !res.ok ) return res;

        this.#phone = phone;

        return result( 200 );
    }
}
