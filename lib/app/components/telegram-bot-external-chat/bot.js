import ExternalChat from "./bot/external-chat.js";

export default Super =>
    class extends Super {
        #externalChat;

        constructor ( ...args ) {
            super( ...args );

            this.#externalChat = new ExternalChat( this );
        }

        // properties
        get externalChat () {
            return this.#externalChat;
        }

        async init () {
            var res;

            res = await super.init();
            if ( !res.ok ) return res;

            return this.#externalChat.init();
        }
    };
