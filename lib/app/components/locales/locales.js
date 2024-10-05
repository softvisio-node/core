import { fileURLToPath } from "node:url";
import Locales from "#lib/locale/locales";
import PoFile from "#lib/locale/po-file";

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
        locales = this.merge( locales, { defaultLocale } );

        try {
            if ( locales.size <= 1 ) throw locales.defaultLocale;

            // locale is not valid
            if ( locale && !locales.has( locale ) ) locale = null;

            // force locale
            if ( locale && forceLocale ) throw locale;

            // user locale
            if ( ctx.user && locales.has( ctx.user.locale ) ) {
                throw ctx.user.locale;
            }
        }
        catch ( e ) {
            locale = e;
        }

        // locale is not set, define by IP address
        if ( !locale && detectLocaleByClientIpAddress && this.config.detectLocaleByClientIpAddress ) {
            const region = ctx.remoteAddress.geoipCountry?.country?.iso_code;

            locale = locales.find( { region } );
        }

        locale ||= locales.defaultLocale;

        return {
            "id": locale,
            "currency": this.currency,
        };
    }
}
