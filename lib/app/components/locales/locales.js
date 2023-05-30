import PoFile from "#lib/locale/po-file";
import { fileURLToPath } from "node:url";

export default class {
    #app;
    #config;
    #components;
    #locales;
    #componentsLocales = {};

    constructor ( app, config, components ) {
        this.#app = app;
        this.#config = config;
        this.#components = components;
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

    get ( componentName ) {
        if ( !componentName ) {
            this.#componentsLocales._app ??= PoFile.createLanguageDomains(

                //
                this.locales,
                fileURLToPath( new URL( "../resources/locales", this.#app.location ) ),
                { "currency": this.currency }
            );

            return this.#componentsLocales._app;
        }
        else {
            if ( this.#componentsLocales[componentName] === undefined ) {
                this.#componentsLocales[componentName] = null;

                const component = this.#components.get( componentName );

                if ( component ) {
                    this.#componentsLocales[componentName] = PoFile.createLanguageDomains(

                        //
                        this.locales,
                        fileURLToPath( new URL( "locales", component.location ) ),
                        { "currency": this.currency }
                    );
                }
            }

            return this.#componentsLocales[componentName];
        }
    }
}
