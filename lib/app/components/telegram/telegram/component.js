import Component from "#lib/app/component";
import TelegramBot from "./bot.js";
import sql from "#lib/sql";
import Locales from "#lib/locale/locales";
import { camelToKebabCase } from "#lib/naming-conventions";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";

const SQL = {
    "getBotFields": sql`
SELECT
    telegram_bot.*,
    telegram_bot_api_token.api_token AS telegram_api_token
FROM
    telegram_bot
    LEFT JOIN telegram_bot_api_token ON ( telegram_bot.id = telegram_bot_api_token.telegram_bot_id )
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
        return this.config.telegram.acl;
    }

    // public
    async createBot ( dbh, id, options ) {
        return this._createBot( dbh, id, options );
    }

    async getBotFields ( id ) {
        return this._getBotFields( id );
    }

    // protected
    async _configure () {

        // add acl "owner" role
        this.config.telegram.acl ??= {};
        this.config.telegram.acl.roles ??= {};

        this.config.telegram.acl.roles.owner ??= {
            "name": this.app.locale.l10nt( `Owner` ),
            "description": this.app.locale.l10nt( `Bot owner` ),
            "permissions": [

                //
                "acl:*",
                "telegram/bot:*",
                "telegram/bot/**",
                "!telegram/bot:create",
            ],
        };

        this.config.telegram.acl.roles.administrator ??= {
            "name": this.app.locale.l10nt( `Administrator` ),
            "description": this.app.locale.l10nt( `Bot administrator. Full access, but can't delete bot.` ),
            "permissions": [

                //
                "acl:*",
                "telegram/bot:*",
                "telegram/bot/**",
                "!telegram/bot:create",
                "!telegram/bot:delete",
            ],
        };

        // prepare acl
        this.config.telegram.acl = {
            [this.aclType]: this.config.telegram.acl,
        };

        return result( 200 );
    }

    _validateConfig () {
        const ajv = new Ajv().addSchema( readConfig( new URL( "config.schema.yaml", import.meta.url ) ) );

        // validate env
        if ( ajv?.getSchema( "env" ) && !ajv.validate( "env", process.env ) ) {
            return result( [400, `Component "${this.name}" env is not valid:\n` + ajv.errors] );
        }

        // validate config
        if ( ajv?.getSchema( "config" ) && !ajv.validate( "config", this.config.telegram ) ) {
            return result( [400, `Component "${this.name}" config is not valid:\n` + ajv.errors] );
        }

        return super._validateConfig();
    }

    async _init () {
        this.app.telegram.registerComponent( this );

        this.#locales = new Locales( this.app.locales.merge( this.config.telegram.locales ) );

        return super._init();
    }

    async _createBot ( dbh, id, options ) {
        return result( 200 );
    }

    async _getBotFields ( id ) {
        const res = await this.dbh.selectRow( SQL.getBotFields, [id] );

        return res.data;
    }
}
