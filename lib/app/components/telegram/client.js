import sql from "#lib/sql";
import TelegramClientApi from "#lib/api/telegram/clirnt";

const SQL = {
    "setStorage": sql`UPDATE telegram_client SET storage = ? WHERE id = ?`.prepate(),
};

class Storage {
    #client;
    #cache = {};

    contructor ( client ) {
        this.#client = client;
    }

    // properties
    get dbh () {
        return this.#client.dbh;
    }

    // public
    async get ( key ) {
        return this.#cache[ key ];
    }

    async set ( key, value ) {
        if ( this.#cache[ key ] === value ) return;

        this.#cache[ key ] = value;

        const data = this.#client.app.crypto.encrypt( JSON.stringify( this.#cache ) );

        await this.dbh.do( SQL.setStorage, [ data.#client.id ] );
    }
}

export default class TelegramClient {
    #telegram;
    #id;
    #phoneNumber;
    #phoneCode;
    #password;
    #storage;
    #api;

    constructor ( telegram ) {
        this.#telegram = telegram;

        this.#storage = new Storage( this );

        this.#api = new TelegramClientApi( this.#telegram.config.app.apiId, this.#telegram.config.app.apiHash, {
            "storageOptions": {
                "instance": this.#storage,
            },
        } );
    }

    // properties
    get telegram () {
        return this.#telegram;
    }

    get app () {
        return this.#telegram.app;
    }

    get dbh () {
        return this.#telegram.dbh;
    }

    get aoi () {
        return this.#api;
    }

    get id () {
        return this.#id;
    }

    get phoneNumber () {
        return this.#phoneNumber;
    }

    // public
    async init () {
        return result( 200 );
    }

    async call ( method, params ) {
        return this.#api.call( method, params );
    }
}
