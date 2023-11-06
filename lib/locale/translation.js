import JsonContainer from "#lib/json-container";
import { mergeObjects } from "#lib/utils";

export default class Translation {
    #locale;
    #domain;
    #translator;
    #data;
    #msgId;
    #plural;
    #pluralNumber;
    #isEjs;

    constructor ( locale, msgId, { data, plural, pluralNumber, domain } = {} ) {
        this.#locale = locale;
        this.#domain = domain;
        this.#pluralNumber = pluralNumber;

        if ( msgId?.[Symbol.for( "ejs-template" )] ) {
            this.#translator = msgId;
            this.#data = data;

            this.#isEjs = true;
        }
        else if ( typeof msgId === "function" ) {
            this.#translator = msgId;
            this.#data = data;
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

    createTemplate ( data ) {
        if ( this.#translator ) {
            if ( data && this.#data ) {
                data = mergeObjects( {}, this.#data, data );
            }

            return new Translation( this.#locale, this.#translator, {
                "domain": this.#domain,
                "pluralNumber": this.#pluralNumber,
                data,
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
            if ( this.#isEjs ) {
                if ( this.#data ) {
                    return this.#translator.render( {
                        ...this.#data,
                        locale,
                        pluralNumber,
                    } );
                }
                else {
                    return this.#translator.render( {
                        locale,
                        pluralNumber,
                    } );
                }
            }
            else {
                return this.#translator( locale, { pluralNumber, "data": this.#data } );
            }
        }
        else {
            return locale.l10n( this.#msgId, this.#plural, pluralNumber );
        }
    }
}
