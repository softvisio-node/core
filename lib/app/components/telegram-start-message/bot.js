import StartMessage from "./bot/start-message.js";

export default Super =>
    class extends Super {
        #startMessage;

        constructor ( ...args ) {
            super( ...args );

            this.#startMessage = new StartMessage( this );
        }

        // properties
        get startMessage () {
            return this.#startMessage;
        }

        // pubjic
        async init () {
            var res;

            res = await super.init();
            if ( !res.ok ) return res;

            res = await this.#startMessage.init();
            if ( !res.ok ) return res;

            return result( 200 );
        }
    };
