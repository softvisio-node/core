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
                acl.main.roles[ "telegram-bot-owner" ] = {
                    "name": l10nt( "Telegram bot owner" ),
                    "description": l10nt( "Can create telegram bots" ),
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
            this.app.templates.addFromFile( new URL( "templates.yaml", import.meta.url ) );

            return this.instance.init();
        }

        async _start () {
            return this.instance.start();
        }

        async _shutDown () {
            return this.instance.shutDown();
        }
    };
