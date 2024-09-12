import MsgId from "#lib/locale/msgid";
import L10nt from "#lib/locale/l10nt";
import Interval from "#lib/interval";
import DigitalSize from "#lib/digital-size";
import { DEFAULT_LOCALE_ID, DEFAULT_CURRENCY, LOCALES, PLURAL_EXPRESSIONS } from "#lib/locale/constants";

const dateTimeFormats = {},
    numberFormats = {},
    relativeTimeFormats = {},
    digitalSizeFormats = {},
    displayNameFormats = {},
    digitalSizeFormatters = {},
    durationFormats = {},
    listFormats = {};

const relativeTimeFormatters = {},
    displayNamesFormatters = {},
    dateTimeFormatters = {},
    currencyFormatters = {},
    percentFormatters = {},
    numberFormatters = {},
    durationFormatters = {},
    listFormatters = {};

const FORMAT_DURATION_UNITS = {
    "years": "year",
    "months": "month",
    "weeks": "week",
    "days": "day",
    "hours": "hour",
    "minutes": "minute",
    "seconds": "second",
    "milliseconds": "millisecond",
    "microseconds": "microsecond",
    "nanoseconds": "nanosecond",
};

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
            for ( const [ domain, locale ] of Object.entries( id ) ) {
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
            for ( const [ id, locale ] of Object.entries( id ) ) {
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

        for ( const [ id, locale ] of this.#domains.entries() ) json[ id ] = locale.toJSON();

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
            super( DEFAULT_LOCALE_ID );
        }
        else if ( typeof locale === "string" ) {
            super( locale );
        }
        else if ( locale instanceof Locale ) {
            super( locale.id || DEFAULT_LOCALE_ID );

            this.#currency = locale.currency;

            this.add( locale );
        }
        else if ( locale instanceof Intl.Locale ) {
            super( locale.baseName );
        }
        else {
            super( locale.id || DEFAULT_LOCALE_ID );

            this.#currency = locale.currency;

            this.add( locale );
        }

        this.#pluralExpression = PLURAL_EXPRESSIONS[ this.language ];

        this.#currency ||= DEFAULT_CURRENCY;
    }

    // static
    static get default () {
        return DEFAULT_LOCALE;
    }

    static get defaultLocale () {
        return DEFAULT_LOCALE_ID;
    }

    static get defaultCurrency () {
        return DEFAULT_CURRENCY;
    }

    static get L10nt () {
        return L10nt;
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
        this.#languageName ??= this.id === this.language
            ? this.name
            : new Locale( this.language ).name;

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
    l10n ( singular, plural, pluralNumber ) {
        var message, translation;

        if ( plural ) {
            if ( typeof pluralNumber !== "number" ) pluralNumber = 0;

            if ( pluralNumber === 1 ) {
                message = singular;
            }
            else {
                message = plural;
            }

            translation = this.#messages?.[ singular ]?.[ plural ]?.[ this.#pluralExpression( pluralNumber ) ];
        }
        else {
            message = singular;

            translation = this.#messages?.[ singular ]?.[ "" ];
        }

        if ( message instanceof MsgId ) {
            return message.translate( translation );
        }
        else {
            return translation || message;
        }
    }

    l10nt ( singular, plural, pluralNumber ) {
        return new L10nt( this, singular, {
            plural,
            pluralNumber,
        } );
    }

    add ( locale ) {
        if ( !locale ) return;

        if ( locale instanceof Locale ) locale = locale.toJSON();

        if ( locale.messages ) {
            this.#messages ??= {};

            for ( const [ singular, translations ] of Object.entries( locale.messages ) ) {
                this.#messages[ singular ] ??= {};

                for ( const plural in translations ) {
                    this.#messages[ singular ][ plural ] = translations[ plural ];
                }
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

        displayNamesFormatters[ this.id ] ??= {};

        return ( displayNamesFormatters[ this.id ][ format ] ??= new Intl.DisplayNames( this.id, this.parseFormat( format, displayNameFormats ) ) ).of( name );
    }

    formatDate ( value, format ) {
        format ||= "";

        dateTimeFormatters[ this.id ] ??= {};

        return ( dateTimeFormatters[ this.id ][ format ] ??= new Intl.DateTimeFormat( this.id, this.parseFormat( format, dateTimeFormats ) ) ).format( value );
    }

    formatNumber ( value, format ) {
        format ||= "";

        numberFormatters[ this.id ] ??= {};

        return ( numberFormatters[ this.id ][ format ] ??= new Intl.NumberFormat( this.id, this.parseFormat( format, numberFormats ) ) ).format( value );
    }

    formatPercent ( value, format ) {
        format ||= "";

        percentFormatters[ this.id ] = {};

        var formatter = percentFormatters[ this.id ][ format ];

        if ( !formatter ) {
            const parsedFormat = {
                ...this.parseFormat( format, numberFormats ),
                "style": "percent",
            };

            formatter = percentFormatters[ this.id ][ format ] = new Intl.NumberFormat( this.id, parsedFormat );
        }

        return formatter.format( value );
    }

    formatCurrency ( value, format ) {
        format ||= "";

        const formatterId = this.currency + "/" + format;

        currencyFormatters[ this.id ] ??= {};

        var formatter = currencyFormatters[ this.id ][ formatterId ];

        if ( !formatter ) {
            const parsedFormat = {
                "currency": this.currency,
                ...this.parseFormat( format, numberFormats ),
                "style": "currency",
            };

            formatter = currencyFormatters[ this.id ][ formatterId ] = new Intl.NumberFormat( this.id, parsedFormat );
        }

        return formatter.format( value );
    }

    formatRelativeDate ( interval, format ) {
        format ||= "";

        interval = new Interval( interval );

        relativeTimeFormatters[ this.id ] ??= {};

        return ( relativeTimeFormatters[ this.id ][ format ] ??= new Intl.RelativeTimeFormat( this.id, this.parseFormat( format, relativeTimeFormats ) ) ).format( ...interval.getFormatRelativeDateParams() );
    }

    formatDigitalSize ( value, format ) {
        format ||= "";

        digitalSizeFormatters[ this.id ] = {};

        var formatter = digitalSizeFormatters[ this.id ][ format ];

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
                formatter = digitalSizeFormatters[ this.id ][ format ] = new Intl.NumberFormat( this.id, parsedFormat );
            }
        }

        return formatter.format( value );
    }

    // XXX remove this when Intl.DurationFormat will be available
    formatDuration ( interval, format ) {
        format ||= "";

        interval = Interval.new( interval );

        durationFormatters[ this.id ] ??= {};

        return Object.entries( interval.getFormatDurationParams() )
            .map( ( [ unit, value ] ) => {
                unit = FORMAT_DURATION_UNITS[ unit ];

                const formatterId = unit + "/" + format;

                let formatter = durationFormatters[ this.id ][ formatterId ];

                if ( !formatter ) {
                    const parsedFormat = this.parseFormat( format, durationFormats );

                    const effectiveFormat = {
                        "style": "unit",
                        unit,
                        "unitDisplay": parsedFormat.style,
                    };

                    formatter = durationFormatters[ this.id ][ formatterId ] = new Intl.NumberFormat( this.id, effectiveFormat );
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

        durationFormatters[ this.id ] ??= {};

        return ( durationFormatters[ this.id ][ format ] ??= new Intl.DurationFormat( this.id, this.parseFormat( format, durationFormats ) ) ).format( interval.getFormatDurationParams() );
    }

    formatList ( value, format ) {
        format ||= "";

        listFormatters[ this.id ] ??= {};

        return ( listFormatters[ this.id ][ format ] ??= new Intl.ListFormat( this.id, this.parseFormat( format, listFormats ) ) ).format( value );
    }

    parseFormat ( format, cache ) {
        if ( !format ) return {};

        var parsedFormat = cache?.[ format ];

        if ( !parsedFormat ) {
            parsedFormat = {};

            for ( const token of format.split( "," ) ) {
                const idx = token.indexOf( ":" );

                if ( idx < 1 ) continue;

                parsedFormat[ token.substring( 0, idx ) ] = token.substring( idx + 1 );
            }

            // cache parsed format
            if ( cache ) cache[ format ] = parsedFormat;
        }

        return parsedFormat;
    }

    // private
    #parseOptions () {
        const dateTimeOptions = new Intl.DateTimeFormat( this, { "dateStyle": "full", "timeStyle": "full" } ).resolvedOptions();

        this.#hour12 = dateTimeOptions.hour12;

        this.#groupSeparator = "";
        this.#decimalSeparator = "";

        const numberParts = new Intl.NumberFormat( this, { "useGrouping": true } ).formatToParts( 123_456_789.1 );

        for ( const part of numberParts ) {
            if ( part.type === "group" ) this.#groupSeparator = part.value;
            else if ( part.type === "decimal" ) this.#decimalSeparator = part.value;
        }
    }
}

const DEFAULT_LOCALE = new Locale();

if ( typeof window === "undefined" ) {
    if ( !global.l10n ) {
        Object.defineProperty( global, "l10n", {
            "configurable": false,
            "writable": false,
            "enumerable": true,
            "value": DEFAULT_LOCALE.l10n.bind( DEFAULT_LOCALE ),
        } );
    }

    if ( !global.l10nt ) {
        Object.defineProperty( global, "l10nt", {
            "configurable": false,
            "writable": false,
            "enumerable": true,
            "value": DEFAULT_LOCALE.l10nt.bind( DEFAULT_LOCALE ),
        } );
    }
}
