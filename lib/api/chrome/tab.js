module.exports = class ChromeTab {
    type;

    #chrome;
    #id;
    #destroyed;

    constructor ( chrome, options ) {
        this.#chrome = chrome;

        this.#id = options.id;
        this.type = options.type;
    }

    async destroy () {
        if ( this.#destroyed ) return;

        this.#destroyed = true;

        return this.#chrome.closeTab( this.#id );
    }

    async activate () {
        if ( this.#destroyed ) return;

        return this.#chrome.activateTab( this.#id );
    }

    async openTab ( url ) {
        return this.#chrome.openTab( url );
    }
};
