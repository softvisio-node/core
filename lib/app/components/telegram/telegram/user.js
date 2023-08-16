import Events from "#lib/events";
import sql from "#lib/sql";

const SQL = {
    "setTelegramFields": sql`UPDATE telegram_user SET username = ?, first_name = ?, last_name = ?, language_code = ? WHERE id = ?`.prepare(),

    "setPhone": sql`UPDATE telegram_user SET phone = ? WHERE id = ?`.prepare(),
};

export default class TelegramUser extends Events {
    #dbh;
    #userId;
    #telegramId;
    #isBot;
    #username;
    #firstName;
    #lastName;
    #languageCode;
    #phone;

    constructor ( dbh, fields ) {
        super();

        this.#dbh = dbh;

        this.#userId = fields.telegram_user_id;
        this.#telegramId = fields.telegram_id;
        this.#isBot = fields.is_bot;

        this.updateUserFields( fields );
    }

    // properties
    get dbh () {
        return this.#dbh;
    }

    get userId () {
        return this.#userId;
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

    get languageCode () {
        return this.#languageCode;
    }

    get phone () {
        return this.#phone;
    }

    // public
    updateUserFields ( fields ) {
        if ( "username" in fields ) this.#username = fields.username;

        if ( "first_name" in fields ) this.#firstName = fields.first_name;

        if ( "last_name" in fields ) this.#lastName = fields.last_name;

        if ( "language_code" in fields ) {
            if ( this.#languageCode !== fields.language_code ) {
                this.#languageCode = fields.language_code;

                this.emit( "languageCodeUpdate" );
            }
        }

        if ( "phone" in fields ) this.#phone = fields.phone;
    }

    async setTelegramFields ( fields ) {
        var update;

        if ( fields.username !== this.#username ) {
            update = true;
        }
        else if ( fields.first_name !== this.#firstName ) {
            update = true;
        }
        else if ( fields.last_name !== this.#lastName ) {
            update = true;
        }
        else if ( fields.language_code !== this.#languageCode ) {
            update = true;
        }

        if ( !update ) return result( 200 );

        const res = await this.#dbh.do( SQL.setTelegramFields, [

            //
            fields.username,
            fields.first_name,
            fields.last_name,
            fields.language_code,
            this.#userId,
        ] );

        if ( !res.ok ) return res;

        this.#username = fields.username;
        this.#firstName = fields.first_name;
        this.#lastName = fields.last_name;

        if ( this.#languageCode !== fields.language_code ) {
            this.#languageCode = fields.language_code;

            this.emit( "languageCodeUpdate" );
        }

        return result( 200 );
    }

    async updateContact ( contact ) {
        if ( contact.phone_number === this.#phone ) return result( 200 );

        const res = await this.dbh.do( SQL.setPhone, [contact.phone_number, this.#userId] );

        if ( !res.ok ) return res;

        this.#phone = contact.phone_number;

        return result( 200 );
    }
}
