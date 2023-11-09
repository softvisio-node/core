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
        super( config.locales, {
            "defaultLocale": config.defaultLocale,
        } );

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
        PoFile.loadLanguageDomains(

            //
            this.locales,
            fileURLToPath( new URL( "locales", this.#app.location ) ),
            {
                "locale": this.#app.locale,
                "currency": this.currency,
            }
        );

        // load component locales
        for ( const component of this.app.components ) {
            if ( component.name === "locales" ) continue;

            PoFile.loadLanguageDomains(

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

    findClientLocale ( ctx, locale, locales, { defaultLocale, defineLocaleByIpAddress } = {} ) {
        locales = new Set( this.merge( locales ) );

        if ( !locales.has( defaultLocale ) ) {
            defaultLocale = this.defaultLocale;

            if ( !locales.has( defaultLocale ) ) {
                defaultLocale = Locale.defaultLocale;
            }
        }

        // no locales available
        if ( !locales.size ) {
            locale = defaultLocale;
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
        else if ( locale && !locales.has( locale ) ) {
            locale = null;
        }

        // locale is not set, define by IP address
        if ( !locale && defineLocaleByIpAddress && this.config.defineLocaleByIpAddress ) {
            const region = geoipCountry.get( ctx.remoteAddress.toString() )?.country?.iso_code;

            locale = new Locales( [...locales], {
                defaultLocale,
            } ).find( { region } );
        }

        locale ||= defaultLocale;

        this.#backendLocales[locale] ??= new Locale( {
            "id": locale,
            "currency": this.currency,
        } );

        return this.#backendLocales[locale];
    }
}
