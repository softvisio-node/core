import JsonContainer from "#lib/json-container";

export default class LocaleTranslation {
    #locale;
    #domain;
    #translator;
    #msgId;
    #pluralMsgId;
    #pluralNumber;

    constructor ( locale, msgId, { domain, pluralMsgId, pluralNumber } = {} ) {
        this.#locale = locale;
        this.#domain = domain;

        if ( typeof msgId === "function" ) {
            this.#translator = msgId;
            this.#pluralNumber = pluralMsgId;
        }
        else {
            this.#msgId = msgId;
            this.#pluralMsgId = pluralMsgId;
            this.#pluralNumber = pluralNumber;
        }
    }

    // static
    static translate ( localeTranslation, options ) {
        if ( localeTranslation instanceof LocaleTranslation ) {
            return localeTranslation.translate( options );
        }
        else {
            return localeTranslation;
        }
    }

    // public
    translate ( { locale, domain, pluralNumber } = {} ) {
        if ( pluralNumber === undefined ) pluralNumber = this.#pluralNumber;

        locale ||= this.#locale;

        domain ||= this.#domain;

        if ( domain ) {
            domain = locale.domains.get( domain );

            if ( domain ) locale = domain;
        }

        if ( this.#translator ) {
            return this.#translator( locale, pluralNumber );
        }
        else {
            return locale.l10n( this.#msgId, this.#pluralMsgId, pluralNumber );
        }
    }

    toString () {
        return this.translate();
    }

    toJSON () {
        return this.translate( JsonContainer.options );
    }
}
