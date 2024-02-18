import TelegramBot from "../bot.js";
import TelegramBotUser from "./user.js";
import Locales from "#lib/locale/locales";
import { camelToKebabCase } from "#lib/naming-conventions";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import { mergeObjects } from "#lib/utils";

export default Super =>
    class extends Super {
        #dbh;
        #locales;
        #aclType;
        #bot;
        #user;
        #users;

        // properties
        get dbh () {
            return this.app.dbh;
        }

        get Bot () {
            return ( this.#bot ||= this._buildBot() );
        }

        get User () {
            return ( this.#user ||= this._buildUser() );
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

        // protected
        _buildBot () {
            return TelegramBot;
        }

        _buildUser () {
            return TelegramBotUser;
        }

        // XXX
        async _configure () {

            // apply default config
            this.config.telegram = mergeObjects( readConfig( new URL( "config.yaml", import.meta.url ) ), this.config.telegram );

            // check default locale
            if ( this.config.telegram.defaultLocale && !this.config.telegram.locales.includes( this.config.telegram.defaultLoca ) ) {
                return result( [ 400, `Default locale is not valid` ] );
            }

            // add acl "owner" role
            this.config.telegram.acl ??= {};
            this.config.telegram.acl.roles ??= {};

            this.config.telegram.acl.roles.owner ??= {
                "name": global.l10nt( `Owner` ),
                "description": global.l10nt( `Bot owner` ),
                "permissions": [

                    //
                    "acl:*",
                    "telegram/bot:*",
                    "telegram/bot/**",
                    "!telegram/bot:create",
                ],
            };

            this.config.telegram.acl.roles.administrator ??= {
                "name": global.l10nt( `Administrator` ),
                "description": global.l10nt( `Bot administrator. Full access, but can't delete bot.` ),
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
                [ this.aclType ]: this.config.telegram.acl,
            };

            return result( 200 );
        }

        // XXX
        async _init () {
            this.app.telegram.registerComponent( this );

            this.#locales = new Locales( this.app.locales.merge( this.config.telegram.locales ) );

            return super._init();
        }

        // XXX validate config
        async _configureInstance () {
            return super._configureInstance();
        }

        // XXX call from configure
        async _applyTelegramConfig () {}

        // XXX - configure instance
        _validateTelegramConfig () {
            const ajv = new Ajv().addSchema( readConfig( new URL( "config.schema.yaml", import.meta.url ) ) );

            // validate env
            if ( ajv?.getSchema( "env" ) && !ajv.validate( "env", process.env ) ) {
                return result( [ 400, `Component "${ this.name }" env is not valid:\n` + ajv.errors ] );
            }

            // validate config
            if ( ajv?.getSchema( "config" ) && !ajv.validate( "config", this.config ) ) {
                return result( [ 400, `Component "${ this.name }" config is not valid:\n` + ajv.errors ] );
            }

            return super._validateConfig();
        }

        async _createBot ( dbh, id, options ) {
            return result( 200 );
        }
    };
