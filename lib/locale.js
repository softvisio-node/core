import locales from "#lib/locale/locales";
import MsgId from "#lib/locale/msgid";

export default class Locale {
    #language;
    #pluralExpression;
    #pluralFunction;
    #messages = {};
    #domains = {};

    constructor ( locale ) {
        this.add( locale );
    }

    // static
    static new ( locale ) {
        if ( locale instanceof this ) return locale;

        return new this( locale );
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

        // english
        if ( this.#language === "en" ) return this.#translateEnglish( msgId, pluralMsgId, num );

        var translation = this.#translate( msgId, pluralMsgId, num );

        if ( translation ) return translation;

        // fallback to English
        return this.#translateEnglish( msgId, pluralMsgId, num );
    }

    i18nd ( domainId, msgId, pluralMsgId, num ) {
        const domain = this.#domains[domainId];

        if ( domain ) return domain.i18n( msgId, pluralMsgId, num );

        // fallback to English
        return this.#translateEnglish( msgId, pluralMsgId, num );
    }

    add ( locale ) {
        if ( !locale ) return;

        if ( locale instanceof Locale ) locale = locale.toJSON();

        if ( !this.#language ) this.#language = locale.language || null;

        if ( locale.messages ) this.#messages = { ...this.#messages, ...locale.messages };

        if ( !this.#pluralExpression && !locales[this.#language] && locale.pluralExpression ) {
            this.#pluralExpression = locale.pluralExpression;
        }
    }

    toString () {
        return JSON.stringify( this, null, 4 );
    }

    toJSON () {
        const json = {};

        if ( this.#language ) json.language = this.#language;
        if ( this.pluralExpression ) json.pluralExpression = this.pluralExpression;
        if ( this.#messages ) json.messages = this.#messages;

        return json;
    }

    hasDomains ( id ) {
        return !!this.#domains[id];
    }

    getDomains ( id ) {
        return this.#domains[id];
    }

    setDomains ( id, locale ) {
        this.#domains[id] = this.constructor.new( locale );
    }

    deleteDomains ( id ) {
        delete this.#domains[id];
    }

    // private
    #translate ( msgId, pluralMsgId, num ) {
        const translations = this.#messages[msgId];

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

    #translateEnglish ( msgId, pluralMsgId, num ) {
        var translation;

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
}
