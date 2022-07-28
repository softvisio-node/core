export default class LocaleTemplate {
    #locale;
    #msgId;
    #pluralMsgId;
    #num;

    constructor ( locale, msgId, pluralMsgId, num ) {
        this.#locale = locale;
        this.#msgId = msgId;
        this.#pluralMsgId = pluralMsgId;
        this.#num = num;
    }

    // public
    toString ( { num, domain } = {} ) {
        if ( num === undefined ) num = this.#num;

        if ( domain ) {
            return this.#locale.i18nd( domain, this.#msgId, this.#pluralMsgId, num );
        }
        else {
            return this.#locale.i18n( this.#msgId, this.#pluralMsgId, num );
        }
    }

    toJSON () {
        return this.toString();
    }
}
