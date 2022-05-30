export default class Locale {
    #locale;
    #messages;

    constructor ( locale, { messages } = {} ) {
        this.#locale = locale;

        if ( messages ) this._setMessages( messages );
    }

    // properties
    get locale () {
        return this.#locale;
    }

    // public
    i18n ( single, plural, num ) {
        return this.#messages?.[single];
    }

    // protected
    _setMessages ( messages ) {
        this.#messages = messages;
    }
}
