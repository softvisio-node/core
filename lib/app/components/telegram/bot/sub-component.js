import TelegramBot from "../bot.js";
import TelegramBotUser from "./user.js";
import Locales from "#lib/locale/locales";
import { camelToKebabCase } from "#lib/naming-conventions";

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
        // protected
        _applySubConfig () {
            super._applySubConfig();

            this._mergeSubConfig( import.meta.url );
        }

        _applySubSchema ( schema ) {
            return this._mergeSubSchema( super._applySubSchema( schema ), import.meta.url );
        }

        _buildBot () {
            return TelegramBot;
        }

        _buildUser () {
            return TelegramBotUser;
        }

        // XXX
        async _configure () {

            // check default locale
            if ( this.config.telegram.defaultLocale && !this.config.telegram.locales.includes( this.config.telegram.defaultLoca ) ) {
                return result( [ 400, `Default locale is not valid` ] );
            }

            // add acl "owner" role
            this.config.telegram.acl ??= {};
            this.config.telegram.acl.roles ??= {};

            this.config.telegram.acl.roles.owner ??= {
                "name": l10nt( `Owner` ),
                "description": l10nt( `Bot owner` ),
                "permissions": [

                    //
                    "acl:*",
                    "telegram/bot:*",
                    "telegram/bot/**",
                    "!telegram/bot:create",
                ],
            };

            this.config.telegram.acl.roles.administrator ??= {
                "name": l10nt( `Administrator` ),
                "description": l10nt( `Bot administrator. Full access, but can't delete bot.` ),
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

        async _init () {
            this.app.telegram.registerComponent( this );

            this.#locales = new Locales( this.app.locales.merge( this.config.telegram.locales ) );

            return super._init();
        }

        async _createBot ( dbh, id, options ) {
            return result( 200 );
        }
    };
