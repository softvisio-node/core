import Locale from "#lib/locale";

const DEFAULT_LANGUAGE_LOCALE = {
    "en": "en-GB",
};

export default class Locales {
    #locales = new Map();

    constructor ( locales ) {
        this.#set( locales );
    }

    // properties
    get hasLocales () {
        return !!this.#locales.size;
    }

    // public
    set ( locales ) {
        this.#set( locales );
    }

    isAllowed ( locale ) {
        return this.#locales.has( locale );
    }

    // XXX
    defineLocale ( { locale, language, region, locales } = {} ) {
        return DEFAULT_LANGUAGE_LOCALE[language];
    }

    [Symbol.iterator] () {
        return this.#locales.values();
    }

    toJSON () {
        return [...this.#locales.keys()];
    }

    // private
    // XXX
    #set ( locales ) {
        this.#locales.clear();

        const languages = [],
            regions = {};

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

                languages[locale.language] ??= [];
                languages[locale.language].push( locale.id );

                regions[locale.region] ??= [];
                regions[locale.region].push( locale.id );
            }

            for ( const locale of this.#locales.values() ) {
                if ( languages[locale.language].length === 1 ) {
                    locale.languageName = new Locale( locale.language ).name;
                }
                else {
                    locale.languageName = locale.name;
                }
            }
        }
    }
}
