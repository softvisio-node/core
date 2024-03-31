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
        this.#phoneNumber = fields.phone_number;

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
    async init () {

        // create api
        this.#api = new TelegramClientApi( this.#telegram.config.app.apiId, this.#telegram.config.app.apiHash, {
            "storageOptions": {
                "instance": {
                    "get": this.#getStorageKey.bind( this ),

                    "set": this.#setStorageKey.bind( this ),
                },
            },
        } );

        return this.#signIn();
    }

    async shutDoen () {
        return this.#api.shutDown();
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

    async setPhoneCode ( phoneCode ) {
        if ( this.isStatic ) return result( [ 400, `Unable to update static client` ] );

        phoneCode ||= null;

        if ( phoneCode === this.#phoneCode ) return result( 200 );

        if ( phoneCode ) {
            var encryptedPhoneCode = this.app.crypto.encrypt( phoneCode ).toString( "base64" );
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

    async setPassword ( password ) {
        if ( this.isStatic ) return result( [ 400, `Unable to update static client` ] );

        password ||= null;

        if ( password === this.#password ) return result( 200 );

        if ( password ) {
            var encryptedPassword = this.app.crypto.encrypt( password ).toString( "base64" );
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

        const data = this.app.crypto.encrypt( JSON.stringify( this.#storage ) ).toString( "base64" );

        await this.dbh.do( SQL.setStorage, [ data, this.id ] );
    }

    // XXX mutex
    async #signIn () {
        const res = await this.#api.signIn( {
            "phoneNumber": this.#phoneNumber,
            "phoneCode": this.#phoneCode,
            "password": this.#password,
        } );

        this.#setReady( this.#api.isReady );

        return res;
    }

    #setReady ( ready ) {
        if ( this.#ready === ready ) return;

        this.#ready = ready;

        this.emit( "readtChange" );
    }
}
