import PoFile from "#lib/locale/po-file";
import { fileURLToPath } from "node:url";
import Locale from "#lib/locale";
import Locales from "#lib/locale/locales";
import geoipCountry from "#lib/geoip-country";

export default class extends Locales {
    #app;
    #config;
    #backendLocales = {};

    constructor ( app, config ) {
        super( config.locales );

        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get currency () {
        return this.#config.currency;
    }

    // public
    init () {

        // load app locale domains
        PoFile.loadDomains(

            //
            this.locales,
            fileURLToPath( new URL( "../resources/locales", this.#app.location ) ),
            {
                "locale": this.#app.locale,
                "currency": this.currency,
            }
        );

        // load component locales
        for ( const component of this.app.components ) {
            if ( component.name === "locales" ) continue;

            PoFile.loadDomains(

                //
                this.locales,
                component.location + "/locales",
                {
                    "locale": this.#app.locale,
                    "currency": this.currency,
                }
            );
        }

        return result( 200 );
    }

    getBackendLocale ( ctx, locale, locales ) {
        locales = new Set( this.merge( locales ) );

        // no locales available
        if ( !locales.size ) {
            locale = this.defaultLocale;
        }

        // 1 locale available
        else if ( locales.size === 1 ) {
            locale = locales[0];
        }

        // user locale
        else if ( ctx.user.isAuthenticated && locales.has( ctx.user.locale ) ) {
            locale = ctx.user.locale;
        }

        // locale is set
        else if ( locale ) {

            // locale is set but not supported
            if ( !locales.has( locale ) ) {
                locale = this.defaultLocale;
            }
        }

        // locale is not set, define by IP address
        else {
            const region = geoipCountry.get( ctx.remoteAddress.toString() )?.country?.iso_code;

            locale = new Locales( [...locales] ).find( { region } );
        }

        this.#backendLocales[locale] ??= new Locale( {
            "id": locale,
            "currency": this.currency,
        } );

        return this.#backendLocales[locale];
    }
}
