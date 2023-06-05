import PoFile from "#lib/locale/po-file";
import { fileURLToPath } from "node:url";
import Locale from "#lib/locale";

export default class {
    #app;
    #config;
    #locales;
    #appLocale;
    #componentsLocales = {};
    #backendLocales = {};

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#locales = new Set( config.locales );
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get locales () {
        return this.#config.locales;
    }

    get defaultLocale () {
        return this.#config.defaultLocale;
    }

    get currency () {
        return this.#config.currency;
    }

    // public
    isLocaleValid ( locale ) {
        return this.#locales.has( locale );
    }

    getValidLocale ( locale ) {
        if ( this.#locales.has( locale ) ) {
            return locale;
        }
        else {
            return this.defaultLocale;
        }
    }

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

    // XXX get locale by ip address
    async getBackendLocale ( ctx, locale, locales ) {
        if ( ctx.isAuthenticated ) {
            locale = ctx.user.locale;
        }
        else if ( !locale ) {

            // XXX get locale by ctx.remoteAddress
            locale = this.defaultLocale;
        }

        if ( !this.isLocaleValid( locale ) ) locale = this.defaultLocale;

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
}
