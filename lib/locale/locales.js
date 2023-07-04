import Locale from "#lib/locale";

const DEFAULT_LANGUAGE_LOCALE = {
    "en": "en-GB",
};

export default class Locales {
    #locales = new Map();

    constructor ( locales ) {
        this.#setLocales( locales );
    }

    // public
    isAllowed ( locale ) {
        return this.#locales.has( locale );
    }

    // XXX
    getValidLocale ( { locale, language, region, locales } = {} ) {
        return DEFAULT_LANGUAGE_LOCALE[language];
    }

    [Symbol.iterator] () {
        return this.#locales.values();
    }

    toJSON () {
        return [...this.#locales.keys()];
    }

    // private
    #setLocales ( locales ) {
        this.#locales.clear();

        const languages = [],
            regions = {};

        if ( locales ) {
            for ( let locale of locales ) {
                locale = new Locale( locale );

                if ( !locale.isValid( locale ) ) continue;

                if ( this.#locales.has( locale.id ) ) continue;

                this.#locales.set( locale.id, {
                    "id": locale.id,
                    "name": locale.name,
                    "language": locale.language,
                    "languageName": null,
                    "region": locale.region,
                } );

                languages[locale.language] ??= [];
                languages[locale.language].push( locale.id );

                regions[locale.region] ??= [];
                regions[locale.region].push( locale.id );
            }

            for ( const locale of this.#locales.values() ) {
                if ( languages[locale].length === 1 ) {
                    locale.languageName = new Locale( locale.language ).name;
                }
                else {
                    locale.languageName = locale.name;
                }
            }
        }
    }
}
