import TelegramWalletPayApi from "#lib/api/telegram/wallet-pay";

export default class {
    #bot;
    #api;
    #storageApiKey;

    constructor ( bot ) {
        this.#bot = bot;

        this.#api = new TelegramWalletPayApi( this.#storageApiKey );
    }

    // properties
    get bot () {
        return this.#bot;
    }

    // public
    // XXX
    async checkOrder () {}
}
