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
    static translate ( template, options ) {
        if ( template instanceof LocaleTemplate ) {
            return template.toString( options );
        }
        else {
            return template;
        }
    }

    // public
    toString ( { locale, domain, num } = {} ) {
        if ( num === undefined ) num = this.#pluralNumber;

        if ( !locale ) {
            if ( domain ) locale = this.#locale.domains.get( domain );

            locale ||= this.#locale;
        }

        if ( typeof this.#msgId === "function" ) {
            return this.#msgId( locale, num );
        }
        else {
            return locale.i18n( this.#msgId, this.#pluralMsgId, num );
        }
    }

    toJSON () {
        return this.toString();
    }
}
