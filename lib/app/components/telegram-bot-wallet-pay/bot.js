import WalletPay from "./bot/wallet-pay";

export default Super =>
    class extends Super {
        #walletPay;

        constructor ( ...args ) {
            super( ...args );

            this.#walletPay = new WalletPay( this );
        }

        // properties
        get walletPay () {
            return this.#walletPay;
        }

        // pubjic
        async init () {
            var res;

            res = await super.init();
            if ( !res.ok ) return res;

            res = await this.#walletPay.init();
            if ( !res.ok ) return res;

            return result( 200 );
        }
    };
