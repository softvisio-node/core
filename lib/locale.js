import MsgId from "#lib/locale/msgid";

const DEFAULT_CURRENCY = "USD";

const dateTimeFormats = {},
    numberFormats = {};

class Domains {
    #domains = new Map();

    // public
    has ( id ) {
        return this.#domains.has( id );
    }

    get ( id ) {
        return this.#domains.get( id );
    }

    add ( id, locale ) {
        if ( typeof id === "object" ) {
            for ( const [id, locale] of Object.entries( id ) ) {
                if ( !this.#domains.has( id ) ) this.#domains.set( id, new Locale() );

                this.#domains.get( id ).add( locale );
            }
        }
        else {
            if ( !this.#domains.has( id ) ) this.#domains.set( id, new Locale() );

            this.#domains.get( id ).add( locale );
        }
    }

    set ( id, locale ) {
        if ( typeof id === "object" ) {
            for ( const [id, locale] of Object.entries( id ) ) {
                this.delete( id );
                this.add( id, locale );
            }
        }
        else {
            this.delete( id );
            this.add( id, locale );
        }
    }

    delete ( id ) {
        this.#domains.delete( id );
    }

    toJSON () {
        if ( !this.#domains.size ) return;

        const json = {};

        for ( const [id, locale] of this.#domains.entries() ) json[id] = locale.toJSON();

        return json;
    }
}

export default class Locale {
    #name;
    #intlLocale;
    #pluralExpression;
    #pluralFunction;
    #messages = {};
    #currency;
    #domains;
    #dateTimeFormatters = {};
    #numberFormatters = {};
    #percentFormatters = {};
    #currencyFormatters = {};
    #_options;

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

    get domains () {
        this.#domains ??= new Domains();

        return this.#domains;
    }

    get hour12 () {
        return this.#options?.hour12;
    }

    get groupSeparator () {
        return this.#options?.groupSeparator;
    }

    get decimalSeparator () {
        return this.#options?.decimalSeparator;
    }

    get currency () {
        this.#currency ||= DEFAULT_CURRENCY;

        return this.#currency;
    }

    // public
    i18n ( msgId, pluralMsgId, num ) {
        var translation = this.#translate( msgId, pluralMsgId, num );

        if ( translation ) return translation;

        // fallback to English
        return this.#translateEnglish( msgId, pluralMsgId, num );
    }

    i18nd ( domainId, msgId, pluralMsgId, num ) {
        const domain = this.#domains.get( domainId );

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

        if ( locale.currency ) {
            this.#currency = locale.currency;

            this.#currencyFormatters = {};
        }

        if ( locale.domains ) this.domains.add( locale.domains );
    }

    toString () {
        return this.id;
    }

    toJSON () {
        const json = {};

        if ( this.id ) json.id = this.id;
        if ( this.pluralExpression ) json.pluralExpression = this.pluralExpression;
        if ( this.#messages ) json.messages = this.#messages;
        if ( this.currency !== DEFAULT_CURRENCY ) json.currency = this.currency;
        if ( this.#domains ) json.domains = this.#domains.toJSON();

        return json;
    }

    formatDate ( value, format ) {
        return ( this.#dateTimeFormatters[format || ""] ??= new Intl.DateTimeFormat( this.intlLocale, this.#parseFormat( dateTimeFormats, format ) ) ).format( value );
    }

    formatNumber ( value, format ) {
        return ( this.#numberFormatters[format || ""] ??= new Intl.NumberFormat( this.intlLocale, this.#parseFormat( numberFormats, format ) ) ).format( value );
    }

    formatPercent ( value, format ) {
        var formatter = this.#percentFormatters[format || ""];

        if ( !formatter ) {
            const parsedFormat = {
                ...this.#parseFormat( numberFormats, format ),
                "style": "percent",
            };

            formatter = this.#percentFormatters[format || ""] = new Intl.NumberFormat( this.intlLocale, parsedFormat );
        }

        return formatter.format( value );
    }

    formatCurrency ( value, format ) {
        var formatter = this.#currencyFormatters[format || ""];

        if ( !formatter ) {
            const parsedFormat = {
                "currency": this.currency,
                ...this.#parseFormat( numberFormats, format ),
                "style": "currency",
            };

            formatter = this.#currencyFormatters[format || ""] = new Intl.NumberFormat( this.intlLocale, parsedFormat );
        }

        return formatter.format( value );
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
        this.#_options = null;
    }

    get #options () {
        if ( !this.#_options ) {
            const options = new Intl.DateTimeFormat( this.intlLocale, { "dateStyle": "full", "timeStyle": "full" } ).resolvedOptions(),
                parts = new Intl.NumberFormat( this.intlLocale, { "useGrouping": true } ).formatToParts( 123456789.12345678 );

            this.#_options = {
                "hour12": options.hour12,
            };

            for ( const part of parts ) {
                if ( part.type === "group" ) this.#_options.groupSeparator = part.value;
                else if ( part.type === "decimal" ) this.#_options.decimalSeparator = part.value;
            }
        }

        return this.#_options;
    }

    #parseFormat ( cache, format ) {
        if ( !format ) return {};

        var parsedFormat = cache[format];

        if ( !parsedFormat ) {
            parsedFormat = {};

            for ( const token of format.split( "," ) ) {
                const idx = token.indexOf( ":" );

                if ( idx < 1 ) continue;

                parsedFormat[token.substring( 0, idx )] = token.substring( idx + 1 );
            }

            // cache parsed format
            cache[format] = parsedFormat;
        }

        return parsedFormat;
    }
}
