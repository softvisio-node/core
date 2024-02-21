import Locale from "#lib/locale";

export default class Locales {
    #locales;
    #defaultLocale;
    #keys;
    #languageLocale;
    #languages;
    #regionLocale;

    // XXX
    constructor ( locales, { defaultLocale } = {} ) {
        this.#set( locales );

        if ( !this.#locales.has( defaultLocale ) ) {
            if ( this.#locales.size === 1 ) {
                defaultLocale = this.#keys[ 0 ];
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
        return this.#keys;
    }

    get size () {
        return this.#locales.size;
    }

    get languages () {
        return ( this.#languages ??= new Set( Object.keys( this.#languageLocale ) ) );
    }

    // public
    has ( locale ) {
        return this.#locales.has( locale );
    }

    get ( locale ) {
        return this.#locales.get( locale );
    }

    getLanguageLocale ( language ) {
        return this.#languageLocale[ language ];
    }

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
        return this.#locales.values();
    }

    toJSON () {
        return this.locales;
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

                this.#languageLocale[ locale.language ] ??= locale.id;
                this.#regionLocale[ locale.region ] ??= locale.id;

                languages[ locale.language ] ??= 0;
                languages[ locale.language ]++;
            }

            for ( const locale of this.#locales.values() ) {
                if ( languages[ locale.language ] === 1 ) {
                    locale.languageName = new Locale( locale.language ).name;
                }
                else {
                    locale.languageName = locale.name;
                }

                Object.freeze( locale );
            }

            this.#keys = [ ...this.#locales.keys() ];
            Object.freeze( this.#keys );
        }
    }
}
