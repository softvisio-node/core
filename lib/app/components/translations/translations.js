import Locale from "#lib/locale";
import sql from "#lib/sql";

const SQL = {
    "loadTranslations": sql`SELECT * FROM translations`.prepare(),
};

export default class Translations {
    #app;
    #config;
    #locales;

    constructor ( app, config ) {
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

    get dbh () {
        return this.#app.dbh;
    }

    // public
    async init () {
        var res;

        // init db
        res = await this.app.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        res = await this.#loadTranslations();
        if ( !res.ok ) return res;

        this.dbh.on( "connect", this.#loadTranslations.bind( this ) );

        return result( 200 );
    }

    // XXX
    async addTranslation ( language ) {
        if ( !Locale.languageisValid( language ) ) return result( [ 400, "Language is not valid" ] );
    }

    // XXX
    l10nt ( localeId, translationId ) {
        return this.#locales[ localeId ];
    }

    // private
    // XXX
    async #loadTranslations () {
        var res;

        res = await this.dbh.select( SQL.loadTranslations );
        if ( !res.ok ) return res;

        this.#locales = {};

        return result( 200 );
    }
}
