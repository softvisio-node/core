import Component from "#lib/app/component";
import TelegramBot from "./bot.js";
import sql from "#lib/sql";
import Locales from "#lib/locale/locales";
import { camelToKebabCase } from "#lib/utils/naming-conventions";

const SQL = {
    "getBotFields": sql`
SELECT
    telegram_bot.*,
    telegram_bot_api_key.api_key AS telegram_api_key
FROM
    telegram_bot
    LEFT JOIN telegram_bot_api_key ON ( telegram_bot.id = telegram_bot_api_key.telegram_bot_id )
WHERE telegram_bot.id = ?
`.prepare(),
};

export default class extends Component {
    #dbh;
    #locales = {};
    #aclType;

    // properties
    get dbh () {
        return this.app.dbh;
    }

    get Bot () {
        return TelegramBot;
    }

    get locales () {
        return this.#locales;
    }

    get aclType () {
        return ( this.#aclType ??= camelToKebabCase( this.name ) );
    }

    get aclConfig () {
        return this.config.acl;
    }

    // public
    async _configure () {

        // add acl "owner" role
        this.config.acl ??= {};
        this.config.acl.roles ??= {};
        this.config.acl.roles.owner ??= {
            "name": this.app.locale.l10nt( `Owner` ),
            "description": this.app.locale.l10nt( `Bot owner` ),
            "permissions": [

                //
                "acl:*",
                "telegram/bot:*",
                "telegram/bot/**",
            ],
        };

        // prepare acl
        this.config.acl = {
            [this.aclType]: this.config.acl,
        };

        return result( 200 );
    }

    async _init () {
        this.#locales = new Locales( this.app.locales.merge( this.config.locales ) );

        return super._init();
    }

    async createBot ( dbh, id, options ) {
        return this._createBot( dbh, id, options );
    }

    async getBotFields ( id ) {
        return this._getBotFields( id );
    }

    // protected
    async _createBot ( dbh, id, options ) {
        return result( 200 );
    }

    async _getBotFields ( id ) {
        const res = await this.dbh.selectRow( SQL.getBotFields, [id] );

        return res.data;
    }
}
