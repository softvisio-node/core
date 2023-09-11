import JsonContainer from "#lib/json-container";

export default class Translation {
    #locale;
    #domain;
    #translator;
    #msgId;
    #plural;
    #pluralNumber;

    constructor ( locale, msgId, { plural, pluralNumber, domain } = {} ) {
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
    static toString ( translation, options ) {
        if ( translation instanceof Translation ) {
            return translation.toString( options );
        }
        else {
            return translation + "";
        }
    }

    // public
    toString ( options ) {
        if ( JsonContainer.started ) {
            return this.#translate( JsonContainer.options?.translation );
        }
        else {
            return this.#translate( options );
        }
    }

    toJSON ( options ) {
        if ( JsonContainer.started ) {
            return this.#translate( JsonContainer.options?.translation );
        }
        else {
            return this.#translate( options );
        }
    }

    // private
    #translate ( { locale, domain, pluralNumber } = {} ) {
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
}
