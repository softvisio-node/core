import sql from "#lib/sql";
import TelegramClientApi from "#lib/api/telegram/client";

const SQL = {
    "setStorage": sql`UPDATE telegram_client SET storage = ? WHERE id = ?`.prepare(),
};

export default class TelegramClient {
    #telegram;
    #id;
    #phoneNumber;
    #static;
    #enabled = false;
    #phoneCode;
    #password;
    #storage = {};
    #api;

    constructor ( telegram, fields ) {
        this.#telegram = telegram;

        this.#id = fields.id;
        this.#phoneNumber = fields.phoneNumber;
        this.#static = fields.static;

        this.updateFields( fields );
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

    get isStatic () {
        return this.#static;
    }

    get isEnabled () {
        return this.#enabled;
    }

    // public
    // XXX - check apiId, apiHash
    // XXX signin mutex
    async init () {

        // create api
        this.#api = new TelegramClientApi( this.#telegram.config.app.apiId, this.#telegram.config.app.apiHash, {
            "storageOptions": {
                "instance": {
                    "get": this.#getStorageKey.bing( this ),

                    "set": this.#setStorageKey.bing( this ),
                },
            },
        } );

        var res;

        // sign in
        res = await this.#api.signIn( {
            "phoneNumber": this.#phoneNumber,
            "phoneCode": this.#getStorageKey( "phoneCode" ),
            "password": this.#getStorageKey( "password" ),
        } );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    updateFields ( fields ) {
        if ( "storage" in fields ) {
            if ( fields.storage ) {
                this.#storage = JSON.parse( this.app.crypto.decrypt( fields.storage ) );
            }
            else {
                fields.storage = {};
            }
        }
    }

    async call ( method, params ) {
        return this.#api.call( method, params );
    }

    // XXX
    async setPhoneCode ( phoneCode ) {
        phoneCode ||= null;

        if ( phoneCode === this.#phoneCode ) return result( 200 );

        if ( phoneCode ) {
            var encryptedPhoneCode = this.app.crypto.encrypt( phoneCode, { "encoding": "base64" } );
        }

        const res = await this.dbh.do( sql`UPDATE telegram_client SET phone_code = ? WHERE id = ?`, [

            //
            encryptedPhoneCode,
            this.id,
        ] );
        if ( !res.ok ) return res;

        this.#phoneCode = phoneCode;

        await this.#signIn();

        return result( 200 );
    }

    // XXX
    async setPassword ( password ) {
        password ||= null;

        if ( password === this.#password ) return result( 200 );

        if ( password ) {
            var encryptedPassword = this.app.crypto.encrypt( password, { "encoding": "base64" } );
        }

        const res = await this.dbh.do( sql`UPDATE telegram_client SET password = ? WHERE id = ?`, [

            //
            encryptedPassword,
            this.id,
        ] );
        if ( !res.ok ) return res;

        this.#password = password;

        await this.#signIn();

        return result( 200 );
    }

    // private
    #getStorageKey ( key ) {
        return this.#storage[ key ];
    }

    async #setStorageKey ( key, value ) {
        if ( this.#storage[ key ] === value ) return;

        this.#storage[ key ] = value;

        const data = this.app.crypto.encrypt( JSON.stringify( this.#storage ) );

        await this.dbh.do( SQL.setStorage, [ data.id ] );
    }

    // XXX
    async #signIn () {}
}
