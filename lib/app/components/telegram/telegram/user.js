import Events from "#lib/events";
import sql from "#lib/sql";

const SQL = {
    "setTelegramFields": sql`UPDATE telegram_user SET username = ?, first_name = ?, last_name = ? WHERE id = ?`.prepare(),

    "setPhone": sql`UPDATE telegram_user SET phone = ? WHERE id = ?`.prepare(),

    "setApiUserId": sql`UPDATE telegram_user SET api_user_id = ? WHERE id = ?`.prepare(),
};

export default class TelegramUser extends Events {
    #dbh;
    #userId;
    #apiUserId;
    #telegramId;
    #isBot;
    #username;
    #firstName;
    #lastName;
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

    get phone () {
        return this.#phone;
    }

    get apiUserId () {
        return this.#apiUserId;
    }

    // public
    updateUserFields ( fields ) {
        if ( "api_user_id" in fields ) {
            const oldValue = this.#apiUserId;

            if ( oldValue !== fields.api_user_id ) {
                this.#apiUserId = fields.api_user_id;

                this.emit( "apiUserIdUpdate", this, fields.api_user_id, oldValue );
            }
        }

        if ( "username" in fields ) this.#username = fields.username;

        if ( "first_name" in fields ) this.#firstName = fields.first_name;

        if ( "last_name" in fields ) this.#lastName = fields.last_name;

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

        if ( !update ) return result( 200 );

        const res = await this.#dbh.do( SQL.setTelegramFields, [

            //
            fields.username,
            fields.first_name,
            fields.last_name,
            this.#userId,
        ] );

        if ( !res.ok ) return res;

        this.#username = fields.username;
        this.#firstName = fields.first_name;
        this.#lastName = fields.last_name;

        return result( 200 );
    }

    async updateContact ( contact ) {
        if ( contact.phone_number === this.#phone ) return result( 200 );

        const res = await this.dbh.do( SQL.setPhone, [contact.phone_number, this.#userId] );

        if ( !res.ok ) return res;

        this.#phone = contact.phone_number;

        return result( 200 );
    }

    async setApiUserId ( apiUserId, { dbh } = {} ) {
        dbh ||= this.dbh;

        return dbh.do( SQL.setApiUserId, [apiUserId, this.#userId] );
    }
}
