import Component from "#lib/app/component";
import Telegram from "./telegram.js";

export default class extends Component {

    // properties
    get storageLocationsConfig () {
        return {
            [this.config.storageLocation]: {
                "private": true,
                "maxAge": this.config.storageMaxAge,
                "cacheControl": this.config.storageCacheControl,
            },
        };
    }

    get aclConfig () {
        const acl = {
            "main": {
                "roles": {
                    "administrator": {
                        "permissions": [

                            //
                            "telegram/**",
                        ],
                    },
                },
            },
        };

        if ( this.config.allowUsersCreateBots ) {
            acl.main.roles["telegram-bot-owner"] = {
                "name": this.app.locale.l10nt( "Telegram bot owner" ),
                "description": this.app.locale.l10nt( "Can create telegram bots" ),
                "permissions": [

                    //
                    "telegram/bot:create",
                ],
            };
        }

        return acl;
    }

    // protected
    async _install () {
        return new Telegram( this.app, this, this.config );
    }

    async _init () {
        return this.instance.init();
    }

    async _start () {
        return this.instance.start();
    }

    async _shutDown () {
        return this.instance.shutDown();
    }
}
