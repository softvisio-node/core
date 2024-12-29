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
                        "telegram-bot-creator": {
                            "name": l10nt( "Telegram bot creator" ),
                            "description": l10nt( "Can create Telegram bots" ),
                            "permissions": [

                                //
                                "telegram/bot:create",
                            ],
                        },
                    },
                },
            };

            return acl;
        }

        // protected
        async _install () {
            return new Telegram( this.app, this.config );
        }

        async _init () {
            return this.instance.init();
        }

        async _start () {
            return this.instance.start();
        }

        async _destroy () {
            return this.instance.shutDown();
        }
    };
