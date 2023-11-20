import Events from "#lib/events";
import sql from "#lib/sql";

const SQL = {
    "setTelegramFields": sql`UPDATE telegram_user SET username = ?, first_name = ?, last_name = ? WHERE id = ?`.prepare(),

    "setPhone": sql`UPDATE telegram_user SET phone = ? WHERE id = ?`.prepare(),
};

export default class TelegramUser extends Events {
    #telegram;
    #userId;
    #apiUserId;
    #telegramId;
    #isBot;
    #username;
    #firstName;
    #lastName;
    #phone;
    #avatarUrl;

    constructor ( telegram, fields ) {
        super();

        this.#telegram = telegram;

        this.#userId = fields.telegram_user_id;
        this.#telegramId = fields.telegram_id;
        this.#isBot = fields.is_bot;

        this.updateUserFields( fields );
    }

    // properties
    get dbh () {
        return this.#telegram.dbh;
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

    get avatarUrl () {
        this.#avatarUrl ??= this.#telegram.config.avatarUrl + this.#telegramId;

        return this.#avatarUrl;
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

    toJSON () {
        return {
            "id": this.#telegramId,
            "api_user_id": this.#apiUserId,
            "telegram_username": this.#username,
            "first_name": this.#firstName,
            "last_name": this.#lastName,
            "phone": this.#phone,
            "avatar_url": this.avatarUrl,
        };
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

        const res = await this.dbh.do( SQL.setTelegramFields, [

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
}
