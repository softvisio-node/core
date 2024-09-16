import Payments from "./bot/payments.js";

export default Super =>
    class extends Super {
        #payments;

        constructor ( ...args ) {
            super( ...args );

            this.#payments = new Payments( this );
        }

        // properties
        get payments () {
            return this.#payments;
        }

        // pubjic
        async init () {
            var res;

            res = await super.init();
            if ( !res.ok ) return res;

            res = await this.#payments.init();
            if ( !res.ok ) return res;

            return result( 200 );
        }
    };
