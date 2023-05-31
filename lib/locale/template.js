export default class LocaleTemplate {
    #locale;
    #msgId;
    #pluralMsgId;
    #num;

    constructor ( locale, msgId, pluralMsgId, num ) {
        this.#locale = locale;

        if ( typeof msgId === "function" ) {
            this.#msgId = msgId;
            this.#num = pluralMsgId;
        }
        else {
            this.#msgId = msgId;
            this.#pluralMsgId = pluralMsgId;
            this.#num = num;
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
        if ( num === undefined ) num = this.#num;

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
