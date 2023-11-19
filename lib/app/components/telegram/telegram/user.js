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
        apiUserId ||= null;

        if ( this.#apiUserId === apiUserId ) return result( 200 );

        dbh ||= this.dbh;

        const res = await dbh.begin( async dbh => {
            let res;

            // unlink
            if ( !apiUserId ) {
                const oldApiUser = await this.app.users.getUserById( this.apiUserId, { dbh } );
                if ( !oldApiUser ) throw result( [404, `API user not founs`] );

                res = await dbh.do( SQL.setApiUserId, [null, this.#userId] );
                if ( !res.ok ) throw res;

                dbh.doAfterCommit( async () => {
                    this.updateUserFields( { "api_user_id": null } );

                    const body = this.app.templates.get( "telegram/unlink-account/body" ).clone( {
                        "data": {
                            "telegramUsername": this.username,
                            "email": oldApiUser.email,
                        },
                    } );

                    this.app.publishToApi( "/notifications/telegram/update/", oldApiUser.id );

                    this.app.notifications.sendNotification( "security", oldApiUser.id, this.app.templates.get( "telegram/unlink-account/subject" ), body );

                    this.sendNotification( this.app.templates.get( "telegram/unlink-account/subject" ), body );
                } );
            }

            // link
            else {
                const newApiUser = await this.app.users.getUserById( apiUserId, { dbh } );
                if ( !newApiUser ) throw result( [404, `API user not founs`] );

                if ( this.apiUserId ) {
                    var oldApiUser = await this.app.users.getUserById( this.apiUserId, { dbh } );
                    if ( !oldApiUser ) throw result( [404, `API user not founs`] );
                }

                const oldTelegramUser = await this.bot.users.getByApiUserId( apiUserId, { dbh } );

                // api user is linked to some other telegram user
                if ( oldTelegramUser ) {

                    // unlink api user
                    res = await oldTelegramUser.setApiUserId();
                    if ( !res.ok ) throw res;
                }

                // set api user id
                res = await dbh.do( SQL.setApiUserId, [apiUserId, this.#userId] );
                if ( !res.ok ) throw res;

                dbh.doAfterCommit( async () => {
                    this.updateUserFields( { "api_user_id": apiUserId } );

                    this.app.publishToApi( "/notifications/telegram/update/", apiUserId, this );

                    this.app.notifications.sendNotification(
                        "security",
                        apiUserId,
                        this.app.templates.get( "telegram/link-account/subject" ),
                        this.app.templates.get( "telegram/link-account/body" ).clone( {
                            "data": {
                                "telegramUsername": this.username,
                                "email": newApiUser.email,
                            },
                        } )
                    );
                } );
            }

            return result( 200 );
        } );

        return res;
    }
}
