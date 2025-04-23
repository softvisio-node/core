import { toKebabCase } from "#lib/naming-conventions";
import TelegramBot from "../bot.js";
import TelegramBotChannel from "./channel.js";
import TelegramBotGroup from "./group.js";
import TelegramBotUser from "./user.js";

export default Super =>
    class extends Super {
        #locales;
        #aclType;
        #bot;
        #user;
        #group;
        #channel;

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

        get Group () {
            return ( this.#group ||= this._buildGroup() );
        }

        get Channel () {
            return ( this.#channel ||= this._buildChannel() );
        }

        get locales () {
            return this.#locales;
        }

        get aclType () {
            return ( this.#aclType ??= toKebabCase( this.id ) );
        }

        get aclConfig () {
            return this.config.telegram.acl;
        }

        // public
        async createBot ( dbh, id, options ) {
            return this._createBot( dbh, id, options );
        }

        // protected
        _applySubConfig () {
            super._applySubConfig();

            this._mergeSubConfig( import.meta.url );
        }

        _applySubSchema ( schema ) {
            return this._mergeSubSchema( super._applySubSchema( schema ), import.meta.url );
        }

        async _configure () {

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

            if ( this.config.telegram.signoutEnabled && this.config.telegram.signinRequired === "auto" ) {
                return result( [ 400, `signoutEnabled can not be true if signinRequired is "auto"` ] );
            }

            // prepare acl
            this.config.telegram.acl = {
                [ this.aclType ]: this.config.telegram.acl,
            };

            return super._configure();
        }

        async _init () {
            this.#locales = this.app.locales.merge( this.config.telegram.locales, {
                "defaultLocale": this.config.telegram.defaultLocale,
            } );

            // check default locale
            if ( this.config.telegram.defaultLocale && !this.#locales.has( this.config.telegram.defaultLoca ) ) {
                return result( [ 400, `Default locale is not valid` ] );
            }

            this.app.telegram.bots.registerComponent( this );

            return super._init();
        }

        _buildBot () {
            return TelegramBot;
        }

        _buildUser () {
            return TelegramBotUser;
        }

        _buildGroup () {
            return TelegramBotGroup;
        }

        _buildChannel () {
            return TelegramBotChannel;
        }

        async _createBot ( dbh, id, options ) {
            return result( 200 );
        }
    };
