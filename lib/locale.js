import MsgId from "#lib/locale/msgid";
import Translation from "#lib/locale/translation";
import Interval from "#lib/interval";
import DigitalSize from "#lib/digital-size";

const DEFAULT_LOCALE = "en-GB",
    DEFAULT_CURRENCY = "USD";

const dateTimeFormats = {},
    numberFormats = {},
    relativeTimeFormats = {},
    digitalSizeFormats = {},
    displayNameFormats = {},
    digitalSizeFormatters = {},
    durationFormats = {};

const relativeTimeFormatters = {},
    displayNamesFormatters = {},
    dateTimeFormatters = {},
    currencyFormatters = {},
    percentFormatters = {},
    numberFormatters = {},
    durationFormatters = {};

const PLURAL_EXPRESSIONS = {
    "ru": n => ( n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && ( n % 100 < 12 || n % 100 > 14 ) ? 1 : 2 ),
    "uk": n => ( n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && ( n % 100 < 12 || n % 100 > 14 ) ? 1 : 2 ),
};

const LOCALES = new Set( ["af-ZA", "am-ET", "ar-AE", "ar-BH", "ar-DZ", "ar-EG", "ar-IQ", "ar-JO", "ar-KW", "ar-LB", "ar-LY", "ar-MA", "ar-OM", "ar-QA", "ar-SA", "ar-SD", "ar-SY", "ar-TN", "ar-YE", "arn-CL", "as-IN", "az-Cyrl-AZ", "az-Latn-AZ", "az-az", "ba-RU", "be-BY", "bg-BG", "bn-BD", "bn-IN", "bo-CN", "br-FR", "bs-Cyrl-BA", "bs-Latn-BA", "ca-ES", "co-FR", "cs-CZ", "cy-GB", "da-DK", "de-AT", "de-CH", "de-DE", "de-LI", "de-LU", "dsb-DE", "dv-MV", "el-CY", "el-GR", "en-029", "en-AU", "en-BZ", "en-CA", "en-GB", "en-IE", "en-IN", "en-JM", "en-MT", "en-MY", "en-NZ", "en-PH", "en-SG", "en-TT", "en-US", "en-ZA", "en-ZW", "en-cb", "es-AR", "es-BO", "es-CL", "es-CO", "es-CR", "es-DO", "es-EC", "es-ES", "es-GT", "es-HN", "es-MX", "es-NI", "es-PA", "es-PE", "es-PR", "es-PY", "es-SV", "es-US", "es-UY", "es-VE", "et-EE", "eu-ES", "fa-IR", "fi-FI", "fil-PH", "fo-FO", "fr-BE", "fr-CA", "fr-CH", "fr-FR", "fr-LU", "fr-MC", "fy-NL", "ga-IE", "gd-GB", "gd-ie", "gl-ES", "gsw-FR", "gu-IN", "ha-Latn-NG", "he-IL", "hi-IN", "hr-BA", "hr-HR", "hsb-DE", "hu-HU", "hy-AM", "id-ID", "ig-NG", "ii-CN", "in-ID", "is-IS", "it-CH", "it-IT", "iu-Cans-CA", "iu-Latn-CA", "iw-IL", "ja-JP", "ka-GE", "kk-KZ", "kl-GL", "km-KH", "kn-IN", "ko-KR", "kok-IN", "ky-KG", "lb-LU", "lo-LA", "lt-LT", "lv-LV", "mi-NZ", "mk-MK", "ml-IN", "mn-MN", "mn-Mong-CN", "moh-CA", "mr-IN", "ms-BN", "ms-MY", "mt-MT", "nb-NO", "ne-NP", "nl-BE", "nl-NL", "nn-NO", "no-no", "nso-ZA", "oc-FR", "or-IN", "pa-IN", "pl-PL", "prs-AF", "ps-AF", "pt-BR", "pt-PT", "qut-GT", "quz-BO", "quz-EC", "quz-PE", "rm-CH", "ro-RO", "ro-mo", "ru-RU", "ru-mo", "rw-RW", "sa-IN", "sah-RU", "se-FI", "se-NO", "se-SE", "si-LK", "sk-SK", "sl-SI", "sma-NO", "sma-SE", "smj-NO", "smj-SE", "smn-FI", "sms-FI", "sq-AL", "sr-BA", "sr-CS", "sr-Cyrl-BA", "sr-Cyrl-CS", "sr-Cyrl-ME", "sr-Cyrl-RS", "sr-Latn-BA", "sr-Latn-CS", "sr-Latn-ME", "sr-Latn-RS", "sr-ME", "sr-RS", "sr-sp", "sv-FI", "sv-SE", "sw-KE", "syr-SY", "ta-IN", "te-IN", "tg-Cyrl-TJ", "th-TH", "tk-TM", "tlh-QS", "tn-ZA", "tr-TR", "tt-RU", "tzm-Latn-DZ", "ug-CN", "uk-UA", "ur-PK", "uz-Cyrl-UZ", "uz-Latn-UZ", "uz-uz", "vi-VN", "wo-SN", "xh-ZA", "yo-NG", "zh-CN", "zh-HK", "zh-MO", "zh-SG", "zh-TW", "zu-ZA"] );

class LocaleDomains {
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
            for ( const [domain, locale] of Object.entries( id ) ) {
                if ( !this.#domains.has( domain ) ) {
                    this.#domains.set( domain, Locale.new( locale ) );
                }
                else {
                    this.#domains.get( domain ).add( locale );
                }
            }
        }
        else {
            if ( !this.#domains.has( id ) ) {
                this.#domains.set( id, Locale.new( locale ) );
            }
            else {
                this.#domains.get( id ).add( locale );
            }
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

export default class Locale extends Intl.Locale {
    #name;
    #languageName;
    #pluralExpression;
    #messages;
    #currency;
    #domains;
    #hour12;
    #groupSeparator;
    #decimalSeparator;

    constructor ( locale ) {
        if ( !locale ) {
            super( DEFAULT_LOCALE );
        }
        else if ( typeof locale === "string" ) {
            super( locale );
        }
        else if ( locale instanceof Locale ) {
            super( locale.id || DEFAULT_LOCALE );

            this.#currency = locale.currency;

            this.add( locale );
        }
        else if ( locale instanceof Intl.Locale ) {
            super( locale.baseName );
        }
        else {
            super( locale.id || DEFAULT_LOCALE );

            this.#currency = locale.currency;

            this.add( locale );
        }

        this.#pluralExpression = PLURAL_EXPRESSIONS[this.language];

        this.#currency ||= DEFAULT_CURRENCY;
    }

    // static
    static get defaultLocale () {
        return DEFAULT_LOCALE;
    }

    static get defaultCurrency () {
        return DEFAULT_CURRENCY;
    }

    static get Translation () {
        return Translation;
    }

    static new ( locale ) {
        if ( locale instanceof this ) return locale;

        return new this( locale );
    }

    static isValid ( locale ) {
        return LOCALES.has( locale );
    }

    // properties
    get id () {
        return this.baseName;
    }

    get isValid () {
        return LOCALES.has( this.id );
    }

    get name () {
        this.#name ??= this.formatName( this.id, "type:language,languageDisplay:standard,style:short" );

        return this.#name;
    }

    get languageName () {
        this.#languageName ??= this.id === this.language ? this.name : new Locale( this.language ).name;

        return this.#languageName;
    }

    get currency () {
        return this.#currency;
    }

    get domains () {
        this.#domains ??= new LocaleDomains();

        return this.#domains;
    }

    get hour12 () {
        if ( this.#hour12 === undefined ) this.#parseOptions();

        return this.#hour12;
    }

    get groupSeparator () {
        if ( this.#groupSeparator === undefined ) this.#parseOptions();

        return this.#groupSeparator;
    }

    get decimalSeparator () {
        if ( this.#decimalSeparator === undefined ) this.#parseOptions();

        return this.#decimalSeparator;
    }

    // public
    l10n ( msgId, plural, pluralNumber ) {
        var translation = this.#translate( msgId, plural, pluralNumber );

        if ( translation ) {
            return translation;
        }
        else {
            return this.#translateEnglish( msgId, plural, pluralNumber );
        }
    }

    l10nt ( msgId, plural, pluralNumber ) {
        return new Translation( this, msgId, {
            plural,
            pluralNumber,
        } );
    }

    hasTranslation ( msgId ) {
        return this.#messages && msgId in this.#messages;
    }

    add ( locale ) {
        if ( !locale ) return;

        if ( locale instanceof Locale ) locale = locale.toJSON();

        if ( locale.messages ) {
            this.#messages ??= {};

            for ( const [id, translations] of Object.entries( locale.messages ) ) {

                // message exists
                if ( this.#messages[id] ) {
                    let length = translations.length;
                    if ( this.#messages[id].length > length ) length = this.#messages[id].length;

                    for ( let n = 0; n < length; n++ ) {
                        if ( this.#messages[id][n] !== translations[n] ) {
                            console.log( `Translation conflict detected: ${id}` );

                            break;
                        }
                    }
                }

                this.#messages[id] = translations;
            }
        }

        if ( locale.domains ) this.domains.add( locale.domains );
    }

    toString () {
        return this.id;
    }

    toJSON () {
        return {
            "id": this.id,
            "currency": this.currency,
            "messages": this.#messages,
            "domains": this.#domains?.toJSON(),
        };
    }

    // formatters
    formatName ( name, format ) {
        format ||= "";

        displayNamesFormatters[this.id] ??= {};

        return ( displayNamesFormatters[this.id][format] ??= new Intl.DisplayNames( this.id, this.parseFormat( format, displayNameFormats ) ) ).of( name );
    }

    formatDate ( value, format ) {
        format ||= "";

        dateTimeFormatters[this.id] ??= {};

        return ( dateTimeFormatters[this.id][format] ??= new Intl.DateTimeFormat( this.id, this.parseFormat( format, dateTimeFormats ) ) ).format( value );
    }

    formatNumber ( value, format ) {
        format ||= "";

        numberFormatters[this.id] ??= {};

        return ( numberFormatters[this.id][format] ??= new Intl.NumberFormat( this.id, this.parseFormat( format, numberFormats ) ) ).format( value );
    }

    formatPercent ( value, format ) {
        format ||= "";

        percentFormatters[this.id] = {};

        var formatter = percentFormatters[this.id][format];

        if ( !formatter ) {
            const parsedFormat = {
                ...this.parseFormat( format, numberFormats ),
                "style": "percent",
            };

            formatter = percentFormatters[this.id][format] = new Intl.NumberFormat( this.id, parsedFormat );
        }

        return formatter.format( value );
    }

    formatCurrency ( value, format ) {
        format ||= "";

        const formatterId = this.currency + "/" + format;

        currencyFormatters[this.id] ??= {};

        var formatter = currencyFormatters[this.id][formatterId];

        if ( !formatter ) {
            const parsedFormat = {
                "currency": this.currency,
                ...this.parseFormat( format, numberFormats ),
                "style": "currency",
            };

            formatter = currencyFormatters[this.id][formatterId] = new Intl.NumberFormat( this.id, parsedFormat );
        }

        return formatter.format( value );
    }

    formatRelativeDate ( interval, format ) {
        format ||= "";

        interval = new Interval( interval );

        relativeTimeFormatters[this.id] ??= {};

        return ( relativeTimeFormatters[this.id][format] ??= new Intl.RelativeTimeFormat( this.id, this.parseFormat( format, relativeTimeFormats ) ) ).format( ...interval.getFormatRelativeDateParams() );
    }

    formatDigitalSize ( value, format ) {
        format ||= "";

        digitalSizeFormatters[this.id] = {};

        var formatter = digitalSizeFormatters[this.id][format];

        if ( !formatter ) {
            const parsedFormat = {
                "maximumFractionDigits": 1,
                ...this.parseFormat( format, digitalSizeFormats ),
                "style": "unit",
            };

            if ( !parsedFormat.unit ) {
                const params = DigitalSize.new( value ).getFormatDifitalSizeParam();

                parsedFormat.unit = params.unit;
                value = params.value;

                formatter = new Intl.NumberFormat( this.id, parsedFormat );
            }
            else {
                formatter = digitalSizeFormatters[this.id][format] = new Intl.NumberFormat( this.id, parsedFormat );
            }
        }

        return formatter.format( value );
    }

    // XXX remove this when Intl.DurationFormat will be available
    formatDuration ( interval, format ) {
        format ||= "";

        interval = Interval.new( interval );

        durationFormatters[this.id] ??= {};

        return Object.entries( interval.getFormatDurationParams() )
            .map( ( [unit, value] ) => {
                const formatterId = unit + "/" + format;

                let formatter = durationFormatters[this.id][formatterId];

                if ( !formatter ) {
                    const parsedFormat = this.parseFormat( format, durationFormats );

                    const effectiveFormat = {
                        "style": "unit",
                        unit,
                        "unitDisplay": parsedFormat.style,
                    };

                    formatter = durationFormatters[this.id][formatterId] = new Intl.NumberFormat( this.id, effectiveFormat );
                }

                return formatter.format( value, format );
            } )
            .join( " " );
    }

    // XXX Intl.DurationFormat is experimental
    // XXX https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat
    formatDuration1 ( interval, format ) {
        format ||= "";

        interval = Interval.new( interval );

        durationFormatters[this.id] ??= {};

        return ( durationFormatters[this.id][format] ??= new Intl.DurationFormat( this.id, this.parseFormat( format, durationFormats ) ) ).format( interval.getFormatDurationParams() );
    }

    parseFormat ( format, cache ) {
        if ( !format ) return {};

        var parsedFormat = cache?.[format];

        if ( !parsedFormat ) {
            parsedFormat = {};

            for ( const token of format.split( "," ) ) {
                const idx = token.indexOf( ":" );

                if ( idx < 1 ) continue;

                parsedFormat[token.substring( 0, idx )] = token.substring( idx + 1 );
            }

            // cache parsed format
            if ( cache ) cache[format] = parsedFormat;
        }

        return parsedFormat;
    }

    // private
    #translate ( msgId, pluralMsgId, pluralNumber ) {
        if ( this.language === "en" ) return this.#translateEnglish( msgId, pluralMsgId, pluralNumber );

        const translations = this.#messages?.[msgId];

        if ( !translations ) return;

        var id, idx;

        // plural
        if ( pluralMsgId ) {
            id = pluralMsgId;
            idx = this.#pluralExpression?.( pluralNumber );
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

    #translateEnglish ( msgId, pluralMsgId, pluralNumber ) {
        var translation;

        if ( pluralMsgId ) {
            translation = pluralNumber === 1 ? msgId : pluralMsgId;
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

    #parseOptions () {
        const dateTimeOptions = new Intl.DateTimeFormat( this, { "dateStyle": "full", "timeStyle": "full" } ).resolvedOptions();

        this.#hour12 = dateTimeOptions.hour12;

        this.#groupSeparator = "";
        this.#decimalSeparator = "";

        const numberParts = new Intl.NumberFormat( this, { "useGrouping": true } ).formatToParts( 123456789.1 );

        for ( const part of numberParts ) {
            if ( part.type === "group" ) this.#groupSeparator = part.value;
            else if ( part.type === "decimal" ) this.#decimalSeparator = part.value;
        }
    }
}
