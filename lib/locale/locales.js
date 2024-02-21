import Locale from "#lib/locale";

export default class Locales {
    #locales;
    #defaultLocale;
    #languageLocale;
    #regionLocale;

    constructor ( locales, { defaultLocale } = {} ) {
        this.#locales = new Map();

        if ( locales ) {
            for ( const locale of locales ) {
                if ( !Locale.isValid( locale ) ) continue;

                this.#locales.set( locale, null );
            }
        }

        if ( !this.#locales.has( defaultLocale ) ) {
            if ( this.#locales.size === 1 ) {
                defaultLocale = [ ...this.#locales.keys() ][ 0 ];
            }
            else {
                defaultLocale = Locale.defaultLocale;
            }
        }

        this.#defaultLocale = defaultLocale;
    }

    // properties
    get defaultLocale () {
        return this.#defaultLocale;
    }

    get locales () {
        return [ ...this.#locales.keys() ];
    }

    get size () {
        return this.#locales.size;
    }

    get languages () {
        if ( !this.#languageLocale ) this.#buildLocales();

        return Object.keys( this.#languageLocale );
    }

    // public
    has ( locale ) {
        return this.#locales.has( locale );
    }

    get ( locale ) {
        if ( !this.#languageLocale ) this.#buildLocales();

        return this.#locales.get( locale );
    }

    getLanguageLocale ( language ) {
        if ( !this.#languageLocale ) this.#buildLocales();

        return this.#languageLocale[ language ];
    }

    // XXX
    find ( { locale, language, region } = {} ) {
        if ( !this.#locales.size ) {
            return this.defaultLocale;
        }
        else if ( this.#locales.size === 1 ) {
            return this.defaultLocale;
        }
        else if ( locale && this.#locales.has( locale ) ) {
            return locale;
        }
        else if ( language && region && this.#locales.has( language + "-" + region ) ) {
            return language + "-" + region;
        }
        else if ( language && this.#languageLocale[ language ] ) {
            return this.#languageLocale[ language ];
        }
        else if ( region && this.#regionLocale[ region ] ) {
            return this.#regionLocale[ region ];
        }
        else {
            return this.defaultLocale;
        }
    }

    merge ( locales, { defaultLocale } = {} ) {
        const merged = {};

        if ( locales ) {
            for ( const locale of locales ) {
                if ( this.has( locale ) ) merged[ locale ] = true;
            }
        }

        if ( !merged[ defaultLocale ] ) defaultLocale = this.defaultLocale;

        return new this.constructor( Object.keys( merged ), { defaultLocale } );
    }

    // XXX
    canChangeLocale ( currentLocale ) {
        if ( !this.#locales.size ) {
            return false;
        }
        else if ( this.#locales.size > 1 ) {
            return true;
        }
        else {
            return !this.#locales.has( currentLocale );
        }
    }

    [ Symbol.iterator ] () {
        if ( !this.#languageLocale ) this.#buildLocales();

        return this.#locales.values();
    }

    toJSON () {
        return this.locales;
    }

    // private
    #buildLocales () {
        this.#languageLocale = {};
        this.#regionLocale = {};

        for ( const id of this.#locales.keys() ) {
            const locale = new Locale( id );

            this.#locales.set( id.id, {
                id,
                "name": locale.name,
                "language": locale.language,
                "languageName": new Locale( locale.language ).name,
                "region": locale.region,
            } );

            this.#languageLocale[ locale.language ] ??= locale.id;

            this.#regionLocale[ locale.region ] ??= locale.id;
        }
    }
}
