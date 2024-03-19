import sql from "#lib/sql";
import crypto from "node:crypto";

export default class {
    #telegram;
    #clients = {};
    #clientsPhoneNumber = {};
    #appHash;

    constructor ( telegram ) {
        this.#telegram = telegram;
    }

    // properties
    get telegram () {
        return this.#telegram;
    }

    get app () {
        return this.#telegram.app;
    }

    get dbh () {
        return this.#telegram.app.dbh;
    }

    get appHash () {
        return ( this.$appHash ??= crypto
            .createHash( "md5" )
            .update( !this.telegram.config.app.apiId + "/" + !this.telegram.config.app.apiHash )
            .digest( "base64url" ) );
    }

    // public
    // XXX
    async init () {
        if ( !this.telegram.config.app.apiId || !this.telegram.config.app.apiHash ) return result( 200 );

        var res;

        // drop storage if app hash changed
        res = await this.dbh.do( sql`UPDATE telegram_client SET app_hash = ?, storage = NULL WHERE app_hash != ?`, [ this.appHash, this.appHash ] );
        if ( !res.ok ) return res;

        // XXX create clients

        // XXX load clients

        // XXX set listeners

        return result( 200 );
    }
}
