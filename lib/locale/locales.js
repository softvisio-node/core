import Locale from "#lib/locale";

export default class Locales {
    #locales;
    #languageLocale;
    #regionLocale;

    constructor ( locales ) {
        this.#set( locales );
    }

    // properties
    get defaultLocale () {
        return Locale.defaultLocale;
    }

    get hasLocales () {
        return this.#locales.size > 1;
    }

    // public
    hasLocale ( locale ) {
        return this.#locales.has( locale );
    }

    getLocale ( { locale, language, region, locales } = {} ) {
        var allowedLocales;

        if ( locales ) {
            allowedLocales = new Map();

            for ( const locale of locales ) {
                if ( this.#locales.has( locale ) ) allowedLocales.set( locale, this.#locales.get( locale ) );
            }
        }
        else {
            allowedLocales = this.#locales;
        }

        if ( !allowedLocales.size ) {
            return;
        }
        else if ( locale && allowedLocales.has( locale ) ) {
            return locale;
        }
        else if ( language && region && allowedLocales.has( language + "-" + region ) ) {
            return language + "-" + region;
        }
        else if ( language && allowedLocales.has( this.#languageLocale[language] ) ) {
            return this.#languageLocale[language];
        }
        else if ( region && allowedLocales.has( this.#regionLocale[region] ) ) {
            return this.#regionLocale[region];
        }
    }

    [Symbol.iterator] () {
        return this.#locales.values();
    }

    toJSON () {
        return [...this.#locales.keys()];
    }

    // private
    #set ( locales ) {
        this.#locales = new Map();
        this.#languageLocale = {};
        this.#regionLocale = {};

        const languages = [];

        if ( locales ) {
            for ( let locale of locales ) {
                locale = new Locale( locale );

                if ( !locale.isValid ) continue;

                if ( this.#locales.has( locale.id ) ) continue;

                this.#locales.set( locale.id, {
                    "id": locale.id,
                    "name": locale.name,
                    "language": locale.language,
                    "languageName": null,
                    "region": locale.region,
                } );

                this.#languageLocale[locale.language] ??= locale.id;
                this.#regionLocale[locale.region] ??= locale.id;

                languages[locale.language] ??= 0;
                languages[locale.language]++;
            }

            for ( const locale of this.#locales.values() ) {
                if ( languages[locale.language] === 1 ) {
                    locale.languageName = new Locale( locale.language ).name;
                }
                else {
                    locale.languageName = locale.name;
                }
            }
        }
    }
}
