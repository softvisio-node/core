import Events from "#lib/events";
import sql from "#lib/sql";

const SQL = {
    "setFields": sql`UPDATE telegram_group SET title = ? WHERE id = ?`.prepare(),
};

export default class TelegramGroup extends Events {
    #telegram;
    #id;
    #title;
    #url;

    constructor ( telegram, data ) {
        super();

        this.#telegram = telegram;

        const fields = data.telegram_group;

        this.#id = fields.id;

        this.updateTelegramGroupFields( fields );
    }

    // properties
    get telegram () {
        return this.#telegram;
    }

    get dbh () {
        return this.#telegram.dbh;
    }

    get id () {
        return this.#id;
    }

    get title () {
        return this.#title;
    }

    get url () {
        this.#url ??= `https://t.me/c/${ this.#id.toString().replace( "-100", "" ) }`;

        return this.#url;
    }

    // public

    updateTelegramGroupFields ( fields ) {
        if ( "title" in fields ) this.#title = fields.title;
    }

    async setTelegramGroupFields ( fields ) {
        if ( this.#title === fields.title ) return result( 200 );

        const res = await this.dbh.do( SQL.setFields, [ fields.titls, this.#id ] );

        if ( res.ok ) {
            this.#title = fields.title;
        }

        return res;
    }

    toJSON () {
        return {
            "id": this.#id,
            "title": this.#title,
        };
    }
}
