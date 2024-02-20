import PoFile from "#lib/locale/po-file";
import { fileURLToPath } from "node:url";
import Locale from "#lib/locale";
import Locales from "#lib/locale/locales";
import geoipCountry from "#lib/geoip-country";

export default class extends Locales {
    #app;
    #config;

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
            fileURLToPath( new URL( "../resources/locales", this.app.location ) ),
            {
                "currency": this.currency,
            }
        );

        for ( const location of this.app.components.packages ) {
            PoFile.loadLanguageDomains(

                //
                this.locales,
                fileURLToPath( import.meta.resolve( location + "/resources/locales" ) ),
                {
                    "currency": this.currency,
                }
            );
        }

        return result( 200 );
    }

    findClientLocale ( ctx, locale, locales, { defaultLocale, forceLocale, detectLocaleByClientIpAddress } = {} ) {
        locales = new Set( this.merge( locales ) );

        if ( !locales.has( defaultLocale ) ) {
            defaultLocale = this.defaultLocale;

            if ( !locales.has( defaultLocale ) ) {
                defaultLocale = Locale.defaultLocale;
            }
        }

        try {

            // no locales available
            if ( !locales.size ) throw defaultLocale;

            // only 1 locale available
            if ( locales.size === 1 ) throw [ ...locales ][ 0 ];

            // locale is not valid
            if ( locale && !locales.has( locale ) ) locale = null;

            // forse locale
            if ( locale && forceLocale ) throw locale;

            // user locale
            if ( ctx.user.isAuthenticated && locales.has( ctx.user.locale ) ) {
                throw ctx.user.locale;
            }
        }
        catch ( e ) {
            locale = e;
        }

        // locale is not set, define by IP address
        if ( !locale && detectLocaleByClientIpAddress && this.config.detectLocaleByClientIpAddress ) {
            const region = geoipCountry.get( ctx.remoteAddress.toString() )?.country?.iso_code;

            locale = new Locales( [ ...locales ], {
                defaultLocale,
            } ).find( { region } );
        }

        locale ||= defaultLocale;

        return {
            "id": locale,
            "currency": this.currency,
        };
    }
}
