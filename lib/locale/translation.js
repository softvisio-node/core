import JsonContainer from "#lib/json-container";
import { mergeObjects } from "#lib/utils";

export default class Translation {
    #locale;
    #localeDomain;
    #translator;
    #data;
    #msgId;
    #plural;
    #pluralNumber;
    #isEjs;

    constructor ( locale, msgId, { localeDomain, plural, pluralNumber, data } = {} ) {
        this.#locale = locale;
        this.#localeDomain = localeDomain;
        this.#pluralNumber = pluralNumber;

        if ( msgId?.[ Symbol.for( "ejs-template" ) ] ) {
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

    clone ( { locale, localeDomain, pluralNumber, data } = {} ) {
        if ( this.#translator ) {
            return new Translation( locale ?? this.#locale, this.#translator, {
                "pluralNumber": pluralNumber ?? this.#pluralNumber,
                "localeDomain": localeDomain ?? this.#localeDomain,
                "data": this.#mergeData( data ),
            } );
        }
        else {
            return new Translation( locale ?? this.#locale, this.#msgId, {
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
            return locale.l10n( this.#msgId, this.#plural, pluralNumber );
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
