import sql from "#lib/sql";

const SQL = {
    "setPhone": sql`UPDATE `.prepare(),
};

export default class TelegramUser {
    #dbh;
    #id;
    #telegramId;
    #isBot;
    #username;
    #firstName;
    #lastName;
    #phone;

    constructor ( dbh, fields ) {
        this.#dbh = dbh;
        this.#id = fields.id;
        this.#telegramId = fields.telegram_id;
        this.#isBot = fields.is_bot;

        this.updateTelegramUserFields( fields );
    }

    // properties
    get dbh () {
        return this.#dbh;
    }

    get id () {
        return this.#id;
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
    updateTelegramUserFields ( fields ) {
        if ( fields.username != null ) this.#username = fields.username;
        if ( fields.first_name != null ) this.#firstName = fields.first_name;
        if ( fields.last_name != null ) this.#lastName = fields.last_name;
        if ( fields.phone != null ) this.#phone = fields.phone;
    }

    // XXX
    async setTelegramUserFields ( fields ) {
        const update = new Map();

        for ( const field of ["username", "first_name", "last_name"] ) {
            if ( this[field] !== fields[field] ) update.set( field, fields[field] );
        }

        // no changes
        if ( !update.size ) return result( 200 );

        const res = await this.dbh.do( sql`UPDATE telegram_user`.SET( update ).sql`WHERE id = ${this.#id}` );

        if ( !res.ok ) return res;

        // for ( const [field, value] of update.entries() ) {
        // this.#[field] = value;
        // }

        return result( 200 );
    }

    async setPhone ( phone ) {
        if ( phone === this.#phone ) return result( 200 );

        const res = await this.dbh.do( SQL.setPhone, [phone, this.#id] );

        if ( !res.ok ) return res;

        this.#phone = phone;

        return result( 200 );
    }
}
