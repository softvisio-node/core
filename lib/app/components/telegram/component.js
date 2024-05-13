import Telegram from "./telegram.js";

export default Super =>
    class extends Super {

        // properties
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
                acl.main.roles[ "telegram-bot-creator" ] = {
                    "name": l10nt( "Telegram bot creator" ),
                    "description": l10nt( "Can create Telegram bots" ),
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
    };
