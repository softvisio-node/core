import Events from "#lib/events";
import sql from "#lib/sql";

const SQL = {
    "setFields": sql`UPDATE telegram_group SET title = ?, username = ?, is_forum = ? WHERE id = ?`.prepare(),
};

export default class TelegramGroup extends Events {
    #telegram;
    #id;
    #title;
    #username;
    #isForum;
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

    get username () {
        return this.#username;
    }

    get isForum () {
        return this.#isForum;
    }

    get url () {
        this.#url ??= `https://t.me/c/${ this.#id.toString().replace( "-100", "" ) }`;

        return this.#url;
    }

    // public
    getTopicUrl ( topicId ) {
        if ( this.#isForum ) {
            return this.url + "/" + ( topicId || 1 );
        }
        else {
            return this.url;
        }
    }

    updateTelegramGroupFields ( fields ) {
        if ( "title" in fields ) this.#title = fields.title;

        if ( "username" in fields ) this.#username = fields.username;

        if ( "is_forum" in fields ) this.#isForum = fields.is_forum;
    }

    // XXX
    async setTelegramGroupFields ( fields ) {
        if ( this.#title === fields.title && this.#isForum === fields.is_forum ) return result( 200 );

        const res = await this.dbh.do( SQL.setFields, [ fields.titls, fields.is_forum, this.#id ] );

        if ( res.ok ) {
            this.#title = fields.title;
            this.#isForum = fields.is_forum;
        }

        return res;
    }

    toJSON () {
        return {
            "id": this.#id,
            "title": this.#title,
            "username": this.#username,
            "is_forum": this.#isForum,
        };
    }
}
