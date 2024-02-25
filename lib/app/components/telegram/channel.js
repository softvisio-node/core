import Events from "#lib/events";
import sql from "#lib/sql";

const SQL = {
    "setFields": sql`UPDATE telegram_channel SET title = ? WHERE id = ?`.prepare(),
};

export default class TelegramChannel extends Events {
    #telegram;
    #id;
    #title;
    #url;

    constructor ( telegram, data ) {
        super();

        this.#telegram = telegram;

        const fields = data.telegram_channel;

        this.#id = fields.id;

        this.updateTelegramChannelFields( fields );
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

    updateTelegramChannelFields ( fields ) {
        if ( "title" in fields ) this.#title = fields.title;
    }

    async setTelegramChannelFields ( fields ) {
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
