import PoFile from "#lib/locale/po-file";
import { fileURLToPath } from "node:url";
import Locale from "#lib/locale";
import Locales from "#lib/locale/locales";

export default class extends Locales {
    #app;
    #config;
    #appLocale;
    #componentsLocales = {};
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
    getAppLocale () {
        this.#appLocale ??= PoFile.loadDomains(

            //
            this.locales,
            fileURLToPath( new URL( "../resources/locales", this.#app.location ) ),
            { "currency": this.currency }
        );

        return this.#appLocale;
    }

    getComponentLocale ( componentName ) {
        if ( this.#componentsLocales[componentName] === undefined ) {
            this.#componentsLocales[componentName] = null;

            const component = this.app.components.get( componentName );

            if ( component ) {
                this.#componentsLocales[componentName] = PoFile.loadDomains(

                    //
                    this.locales,
                    component.location + "/locales",
                    { "currency": this.currency }
                );
            }
        }

        return this.#componentsLocales[componentName];
    }

    // XXX
    getBackendLocale ( ctx, locale, locales ) {
        locales = new Set( locales );

        const allowedLocales = new Set( this.locales.filter( locale => locales.has( locale ) ) );

        if ( ctx.isAuthenticated && ctx.user.localeIsSet && allowedLocales.has( ctx.user.locale ) ) {
            locale = ctx.user.locale;
        }
        else if ( locale && !allowedLocales.has( locale ) ) {
            locale = null;
        }

        if ( !locale ) {
            locale = this.#getLocaleByIpAddress( ctx.remoteAddress );

            if ( !allowedLocales.has( locale ) ) {
                locale = this.defaultLocale;
            }
        }

        if ( !this.#backendLocales[locale] ) {
            const backendLocale = ( this.#backendLocales[locale] = new Locale( { "id": locale, "currency": this.currency } ) );

            // add components locales
            for ( const component of this.app.components ) {
                const domain = this.getComponentLocale( component.name ).domains.get( locale );

                if ( domain ) backendLocale.add( domain );
            }

            // add app locale
            const domain = this.getAppLocale().domains.get( locale );

            if ( domain ) backendLocale.add( domain );
        }

        return this.#backendLocales[locale];
    }

    // XXX
    #getLocaleByIpAddress ( ipAddress ) {}
}
