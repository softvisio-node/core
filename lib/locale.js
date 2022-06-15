import MsgId from "#lib/locale/msgid";

export default class Locale {
    #name;
    #intlLocale;
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
    get intlLocale () {
        return this.#intlLocale;
    }

    get id () {
        return this.#intlLocale?.baseName;
    }

    get name () {
        this.#name ??= new Intl.DisplayNames( this.intlLocale, {
            "type": "language",
            "languageDisplay": "standard",
            "style": "short",
        } ).of( this.id );

        return this.#name;
    }

    get language () {
        return this.#intlLocale?.language;
    }

    get region () {
        return this.#intlLocale?.region;
    }

    get pluralExpression () {
        return this.#pluralExpression;
    }

    get pluralFunction () {
        if ( this.#pluralFunction === undefined ) {
            this.#pluralFunction = null;

            if ( this.pluralExpression ) {
                try {
                    this.#pluralFunction = eval( `n => ${this.pluralExpression}` );
                }
                catch ( e ) {}
            }
        }

        return this.#pluralFunction;
    }

    // public
    i18n ( msgId, pluralMsgId, num ) {

        // english
        if ( this.language === "en" ) return this.#translateEnglish( msgId, pluralMsgId, num );

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

        if ( !this.#intlLocale && locale.id ) this.#setLocale( locale.id );

        if ( locale.messages ) this.#messages = { ...this.#messages, ...locale.messages };

        if ( !this.#pluralExpression && locale.pluralExpression ) {
            this.#pluralExpression = locale.pluralExpression;
        }
    }

    toString () {
        return this.id;
    }

    toJSON () {
        const json = {};

        if ( this.id ) json.id = this.id;
        if ( this.pluralExpression ) json.pluralExpression = this.pluralExpression;
        if ( this.#messages ) json.messages = this.#messages;

        return json;
    }

    hasDomain ( id ) {
        return !!this.#domains[id];
    }

    getDomain ( id ) {
        return this.#domains[id];
    }

    setDomain ( id, locale ) {
        this.#domains[id] = this.constructor.new( locale );
    }

    deleteDomain ( id ) {
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

    #setLocale ( locale ) {
        this.#intlLocale = new Intl.Locale( locale );

        this.#name = null;
    }
}
