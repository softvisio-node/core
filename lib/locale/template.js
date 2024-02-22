import JsonContainer from "#lib/json-container";
import { mergeObjects } from "#lib/utils";

export default class LocaleTemplate {
    #locale;
    #localeDomain;
    #translator;
    #data;
    #singular;
    #plural;
    #pluralNumber;
    #isEjs;

    constructor ( locale, singular, { localeDomain, plural, pluralNumber, data } = {} ) {
        this.#locale = locale;
        this.#localeDomain = localeDomain;
        this.#pluralNumber = pluralNumber;

        if ( singular?.[ Symbol.for( "ejs-template" ) ] ) {
            this.#translator = singular;
            this.#data = data;

            this.#isEjs = true;
        }
        else if ( typeof singular === "function" ) {
            this.#translator = singular;
            this.#data = data;
        }
        else {
            this.#singular = singular;
            this.#plural = plural;
        }
    }

    // static
    static toString ( translation, options ) {
        if ( translation instanceof LocaleTemplate ) {
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

    clone ( { locale, localeDomain, pluralNumber, data } = {} ) {
        if ( this.#translator ) {
            return new LocaleTemplate( locale ?? this.#locale, this.#translator, {
                "pluralNumber": pluralNumber ?? this.#pluralNumber,
                "localeDomain": localeDomain ?? this.#localeDomain,
                "data": this.#mergeData( data ),
            } );
        }
        else {
            return new LocaleTemplate( locale ?? this.#locale, this.#singular, {
                "plural": this.#plural,
                "pluralNumber": pluralNumber ?? this.#pluralNumber,
                "localeDomain": localeDomain ?? this.#localeDomain,
            } );
        }
    }

    // private
    #translate ( { locale, localeDomain, pluralNumber, data } = {} ) {
        if ( pluralNumber === undefined ) pluralNumber = this.#pluralNumber;

        locale ||= this.#locale;

        localeDomain ||= this.#localeDomain;

        if ( localeDomain ) {
            localeDomain = locale.domains.get( localeDomain );

            if ( localeDomain ) locale = localeDomain;
        }

        if ( this.#translator ) {

            // ejs template
            if ( this.#isEjs ) {
                return this.#translator.render( {
                    locale,
                    msgid,
                    pluralNumber,
                    "data": this.#mergeData( data ),
                } );
            }

            // function
            else {
                return this.#translator( locale, {
                    pluralNumber,
                    "data": this.#mergeData( data ),
                } );
            }
        }
        else {
            return locale.l10n( this.#singular, this.#plural, pluralNumber );
        }
    }

    #mergeData ( data ) {
        if ( !data ) {
            return this.#data;
        }
        else if ( !this.#data ) {
            return data;
        }
        else {
            return mergeObjects( {}, this.#data, data );
        }
    }
}
