import sql from "#lib/sql";
import TelegramClientApi from "#lib/api/telegram/client";
import Events from "#lib/events";

const SQL = {
    "setStorage": sql`UPDATE telegram_client SET storage = ? WHERE id = ?`.prepare(),
};

export default class TelegramClient extends Events {
    #telegram;
    #id;
    #phoneNumber;
    #static;
    #ready = false;
    #phoneCode = null;
    #password = null;
    #storage = {};
    #api;

    constructor ( telegram, fields ) {
        super();

        this.#telegram = telegram;

        this.#id = fields.id;
        this.#static = fields.static;
        this.#phoneNumber = fields.phoneNumber;

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

    get api () {
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

    get isReady () {
        return this.#ready;
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

        // phone code
        if ( "phone_code" in fields ) {
            let phoneCode;

            if ( fields.phone_code ) {
                phoneCode = this.app.crypto.descrypt( fields.phone_code, { "encoding": "base64url" } );
            }
            else {
                phoneCode = null;
            }

            if ( this.#phoneCode !== phoneCode ) {
                this.#phoneCode = phoneCode;
            }
        }

        // password
        if ( "password" in fields ) {
            let password;

            if ( fields.password ) {
                password = this.app.crypto.descrypt( fields.password, { "encoding": "base64url" } );
            }
            else {
                password = null;
            }

            if ( this.#password !== password ) {
                this.#password = password;
            }
        }

        // storage
        if ( "storage" in fields ) {
            if ( fields.storage ) {
                this.#storage = JSON.parse( this.app.crypto.decrypt( fields.storage, { "encoding": "base64url" } ) );
            }
            else {
                this.#storage = {};
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

        const data = this.app.crypto.encrypt( JSON.stringify( this.#storage ), { "encoding": "base64url" } );

        await this.dbh.do( SQL.setStorage, [ data.id ] );
    }

    // XXX
    async #signIn () {}

    #setReady ( ready ) {
        if ( this.#ready === ready ) return;

        this.#ready = ready;

        this.emit( "readtChange" );
    }
}
