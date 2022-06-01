import locales from "#lib/l10n/locales";
import MsgId from "#lib/l10n/msgid";

export default class Locale {
    #language;
    #pluralExpression;
    #pluralFunction;
    #messages;

    constructor ( data ) {
        this.#language = data.language;
        this.#messages = data.messages;

        if ( !locales[this.#language] ) {
            this.#pluralExpression = data.pluralExpression;
        }
    }

    // properties
    get language () {
        return this.#language;
    }

    get pluralExpression () {
        if ( this.#pluralExpression === undefined ) {
            this.#pluralExpression = locales[this.#language]?.expression || null;
        }

        return this.#pluralExpression;
    }

    get pluralFunction () {
        if ( this.#pluralFunction === undefined ) {
            this.#pluralFunction = locales[this.#language]?.function || null;

            if ( !this.#pluralFunction && this.pluralExpression ) {
                try {
                    this.#pluralFunction = eval( `n => ${this.pluralExpression}` );
                }
                catch ( e ) {
                    this.#pluralFunction = null;
                }
            }
        }

        return this.#pluralFunction;
    }

    // public
    i18n ( msgId, pluralMsgId, num ) {
        var translation = this.translate( msgId, pluralMsgId, num );

        if ( translation ) return translation;

        // fallback to English
        if ( pluralMsgId ) {
            translation = num === 1 ? msgId : pluralMsgId;
        }
        else {
            translation = msgId;
        }

        if ( translation instanceof MsgId ) {
            return translation.translate();
        }
        else {
            return translation;
        }
    }

    translate ( msgId, pluralMsgId, num ) {
        const translations = this.#messages[msgId]?.translations;

        if ( !translations ) return;

        var id, idx;

        // plural
        if ( pluralMsgId ) {
            id = pluralMsgId;
            idx = this.pluralFunction?.( num );
        }

        // single
        else {
            id = msgId;
            idx = 0;
        }

        const translation = translations[idx];

        if ( !translation ) return;

        if ( id instanceof MsgId ) {
            return id.translate( translation );
        }
        else {
            return translation;
        }
    }

    toString () {
        return JSON.stringify( this, null, 4 );
    }

    toJSON () {
        const json = {};

        if ( this.#language ) json.language = this.#language;
        if ( this.nplurals ) json.nplurals = this.nplurals;
        if ( this.pluralExpression ) json.pluralExpression = this.pluralExpression;
        if ( this.#messages ) json.messages = this.#messages;

        return json;
    }
}
