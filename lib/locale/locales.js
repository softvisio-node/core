import Locale from "#lib/locale";

const DEFAULT_LANGUAGE_LOCALE = {
    "en": "en-GB",
};

export default class Locales {
    #locales = new Set();
    #languageLocale = {};
    #regionLocale = {};

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

    // private
    #setLocales ( locales ) {
        this.#locales.clear();
        this.#languageLocale = {};
        this.#regionLocale = {};

        if ( locales ) {
            for ( let locale of locales ) {
                locale = new Locale( locale );

                if ( this.#locales.has( locale.id ) ) continue;

                this.#locales.add( locale.id );

                // this.#languages[locale.language].add(locale.id);
            }
        }
    }
}
