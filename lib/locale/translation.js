import JsonContainer from "#lib/json-container";

export default class LocaleTranslation {
    #locale;
    #domain;
    #translator;
    #msgId;
    #plural;
    #pluralNumber;

    constructor ( locale, msgId, { domain, plural, pluralNumber } = {} ) {
        this.#locale = locale;
        this.#domain = domain;
        this.#pluralNumber = pluralNumber;

        if ( typeof msgId === "function" ) {
            this.#translator = msgId;
        }
        else {
            this.#msgId = msgId;
            this.#plural = plural;
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
            return locale.l10n( this.#msgId, {
                "plural": this.#plural,
                pluralNumber,
            } );
        }
    }

    toString () {
        return this.translate();
    }

    toJSON () {
        return this.translate( JsonContainer.options?.localeTranslation );
    }
}
