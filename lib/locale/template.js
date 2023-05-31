export default class LocaleTemplate {
    #locale;
    #msgId;
    #pluralMsgId;
    #pluralNumber;

    constructor ( locale, msgId, pluralMsgId, pluralNumber ) {
        this.#locale = locale;

        if ( typeof msgId === "function" ) {
            this.#msgId = msgId;
            this.#pluralNumber = pluralMsgId;
        }
        else {
            this.#msgId = msgId;
            this.#pluralMsgId = pluralMsgId;
            this.#pluralNumber = pluralNumber;
        }
    }

    // static
    static translate ( localeTemplate, options ) {
        if ( localeTemplate instanceof LocaleTemplate ) {
            return localeTemplate.toString( options );
        }
        else {
            return localeTemplate;
        }
    }

    // public
    toString ( { locale, domain, pluralNumber } = {} ) {
        if ( pluralNumber === undefined ) pluralNumber = this.#pluralNumber;

        if ( !locale ) {
            if ( domain ) locale = this.#locale.domains.get( domain );

            locale ||= this.#locale;
        }

        if ( typeof this.#msgId === "function" ) {
            return this.#msgId( locale, pluralNumber );
        }
        else {
            return locale.i18n( this.#msgId, this.#pluralMsgId, pluralNumber );
        }
    }

    toJSON () {
        return this.toString();
    }
}
