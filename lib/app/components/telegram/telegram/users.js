import sql from "#lib/sql";
import TelegramUser from "./user.js";

const SQL = {
    "getTelegramUserById": sql`SELECT * FROM telegram_user WHERE telegram_id = ?`.prepare(),

    "getTelegramUserByApiUserId": sql`SELECT * FROM telegram_user WHERE api_user_id = ?`.prepare(),
};

export default class {
    #telegram;

    constructor ( telegram ) {
        this.#telegram = telegram;
    }

    // properties
    get dbh () {
        return this.#telegram.dbh;
    }

    // public
    async getTelegramUserById ( telegramUserId, { dbh } = {} ) {
        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getTelegramUserById, [telegramUserId] );

        if ( !res.data ) return;

        return new TelegramUser( this, res.data );
    }

    async getTelegramUserByApiUserId ( apiUserId, { dbh } = {} ) {
        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getTelegramUserByApiUserId, [apiUserId] );

        if ( !res.data ) return;

        return new TelegramUser( this, res.data );
    }
}
