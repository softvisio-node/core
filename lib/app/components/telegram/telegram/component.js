import Component from "#lib/app/component";
import TelegramBot from "./bot.js";
import sql from "#lib/sql";
import Locales from "#lib/locale/locales";

const SQL = {
    "getBotFields": sql`SELECT * FROM telegram_bot WHERE id = ?`.prepare(),
};

export default class extends Component {
    #dbh;
    #locales = {};

    // public
    get dbh () {
        return this.app.dbh;
    }

    get Bot () {
        return TelegramBot;
    }

    get locales () {
        return this.#locales;
    }

    // public
    async init () {
        this.#locales = new Locales( this.app.locales.merge( this.config.locales ) );

        return this._init();
    }

    async createBot ( dbh, id, options ) {
        return this._createBot( dbh, id, options );
    }

    async getBotFields ( id ) {
        return this._getBotFields( id );
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _createBot ( dbh, id, options ) {
        return result( 200 );
    }

    async _getBotFields ( id ) {
        const res = await this.dbh.selectRow( SQL.getBotFields, [id] );

        return res.data;
    }
}
