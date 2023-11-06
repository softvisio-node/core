import JsonContainer from "#lib/json-container";
import { mergeObjects } from "#lib/utils";

export default class Translation {
    #locale;
    #domain;
    #translator;
    #params;
    #msgId;
    #plural;
    #pluralNumber;

    constructor ( locale, msgId, { params, plural, pluralNumber, domain } = {} ) {
        this.#locale = locale;
        this.#domain = domain;
        this.#pluralNumber = pluralNumber;

        if ( typeof msgId === "function" ) {
            this.#translator = msgId;
            this.#params = params;
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
            return translation;
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

    template ( params ) {
        if ( this.#translator ) {
            if ( params && this.#params ) {
                params = mergeObjects( {}, this.#params, params );
            }

            return new Translation( this.#locale, this.#translator, {
                "domain": this.#domain,
                "pluralNumber": this.#pluralNumber,
                params,
            } );
        }
        else {
            return this;
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
            return this.#translator( locale, { pluralNumber, "params": this.#params } );
        }
        else {
            return locale.l10n( this.#msgId, this.#plural, pluralNumber );
        }
    }
}
