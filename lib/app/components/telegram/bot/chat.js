import JsonContainer from "#lib/json-container";

export default Super =>
    class extends Super {
        #bot;
        #avatarUrl;

        constructor ( bot, data ) {
            super( bot.telegram, data );

            this.#bot = bot;
        }

        // properties
        get bot () {
            return this.#bot;
        }

        get avatarUrl () {
            this.#avatarUrl ??= this.#bot.telegram.config.avatarUrl + this.#bot.id + "/" + this.id;

            return this.#avatarUrl;
        }

        get locale () {
            return this.bot.defaultLocale;
        }

        get canSend () {
            return true;
        }

        // public
        toJSON () {
            const json = super.toJSON();

            json.avatar_url = this.avatarUrl;

            return json;
        }

        async send ( method, data ) {
            if ( !this.canSend ) return result( 200 );

            data = new JsonContainer(
                {
                    ...data,
                    "chat_id": this.id,
                },
                {
                    "translation": {
                        "localeDomain": this.locale,
                    },
                }
            );

            return this.#bot.api.send( method, data );
        }

        async sendText ( text ) {
            return this.send( "sendMessage", {
                text,
            } );
        }

        async sendMessage ( data ) {
            return this.send( "sendMessage", data );
        }
    };
