import sql from "#lib/sql";
import TelegramClientApi from "#lib/api/telegram/client";
import Events from "#lib/events";
import fs from "node:fs";

const SQL = {
    "getStorageKey": sql`SELECT storage->? AS value FROM telegram_client WHERE id = ?`.prepare(),

    "setStorageKey": sql`UPDATE telegram_client SET storage = jsonb_set( storage, ?, ?, TRUE ) WHERE id = ?`.prepare(),
};

export default class TelegramClient extends Events {
    #telegram;
    #id;
    #phoneNumber;
    #static;
    #ready = false;
    #phoneCode;
    #password = null;
    #api;

    constructor ( telegram, fields ) {
        super();

        this.#telegram = telegram;

        this.#id = fields.id;
        this.#static = fields.static;
        this.#phoneNumber = fields.phone_number;

        this.#updateFields( fields );
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

    async shutDown () {
        return this.#api.shutDown();
    }

    updateFields ( fields ) {
        const signIn = this.#updateFields( fields );

        if ( signIn ) this.#signIn();
    }

    async call ( method, params ) {
        return this.#api.call( method, params );
    }

    async setPhoneCode ( phoneCode ) {
        if ( this.isStatic ) return result( [ 400, `Unable to update static client` ] );

        if ( !/^\d\d\d\d\d$/.test( phoneCode ) ) return result( 400 );

        this.#phoneCode = phoneCode;

        const res = await this.#signIn();

        if ( res.ok || ( res.status === 401 && !res.data.phoneCodeInvalid ) ) {
            const res = await this.dbh.do( sql`UPDATE telegram_client SET phone_code = ? WHERE id = ?`, [

                //
                this.app.crypto.encrypt( phoneCode ).toString( "base64" ),
                this.id,
            ] );

            if ( !res.ok ) return res;
        }

        return res;
    }

    async setPassword ( password ) {
        if ( this.isStatic ) return result( [ 400, `Unable to update static client` ] );

        if ( !password ) return result( 400 );

        this.#password = password;

        const res = await this.#signIn();

        if ( res.ok || ( res.status === 401 && !res.data.passwordInvalid ) ) {
            const res = await this.dbh.do( sql`UPDATE telegram_client SET password = ? WHERE id = ?`, [

                //
                this.app.crypto.encrypt( password ).toString( "base64" ),
                this.id,
            ] );

            if ( !res.ok ) return res;
        }

        return res;
    }

    // private
    #updateFields ( fields ) {
        var signIn;

        // phone code
        if ( "phone_code" in fields ) {
            let phoneCode;

            if ( fields.phone_code ) {
                phoneCode = this.app.crypto.decrypt( fields.phone_code, { "encoding": "base64url" } );
            }
            else {
                phoneCode = null;
            }

            if ( this.#phoneCode !== phoneCode ) {
                signIn = true;

                this.#phoneCode = phoneCode;
            }
        }

        // password
        if ( "password" in fields ) {
            let password;

            if ( fields.password ) {
                password = this.app.crypto.decrypt( fields.password, { "encoding": "base64url" } );
            }
            else {
                password = null;
            }

            if ( this.#password !== password ) {
                signIn = true;

                this.#password = password;
            }
        }

        return signIn;
    }

    async #getStorageKey ( key ) {
        if ( this.telegram.config.app.useFileStorage ) {
            const path = this.app.env.dataDir + "/telegram/clients/" + this.#phoneNumber;

            if ( fs.existsSync( path ) ) {
                const data = JSON.parse( this.app.crypto.decrypt( fs.readFileSync( path ) ) );

                return data[ key ];
            }
            else {
                return null;
            }
        }
        else {
            const res = await this.dbh.selectRow( SQL.getStorageKey, [ key, this.id ] );

            if ( !res.data?.value ) {
                return;
            }
            else {
                return JSON.parse( this.app.crypto.decrypt( res.data.value, { "encoding": "base64url" } ) );
            }
        }
    }

    async #setStorageKey ( key, value ) {
        if ( this.telegram.config.app.useFileStorage ) {
            const dir = this.app.env.dataDir + "/telegram/clients/",
                path = dir + "/" + this.#phoneNumber;

            var data;

            if ( fs.existsSync( path ) ) {
                data = JSON.parse( this.app.crypto.decrypt( fs.readFileSync( path ) ) );
            }
            else {
                data = {};

                fs.mkdirSync( dir, {
                    "recursive": true,
                } );
            }

            data[ key ] = value;

            fs.writeFileSync( path, this.app.crypto.encrypt( JSON.stringify( data ) ) );
        }
        else {
            if ( value != null ) {
                value = this.app.crypto.encrypt( JSON.stringify( value ) ).toString( "base64url" );

                return this.dbh.do( SQL.setStorageKey, [ `{${ key }}`, `"${ value }"`, this.id ] );
            }
        }
    }

    async #signIn () {
        if ( this.app.cluster ) {
            var mutex = this.app.cluster.mutexes.get( "telegram-client/sign-in/" + this.phoneNumber );

            await mutex.lock();
        }

        const res = await this.#api.signIn( {
            "phoneNumber": this.#phoneNumber,
            "phoneCode": this.#phoneCode,
            "password": this.#password,
        } );

        this.#setReady( this.#api.isReady );

        await mutex?.unlock();

        return res;
    }

    #setReady ( ready ) {
        if ( this.#ready === ready ) return;

        this.#ready = ready;

        this.emit( "readyChange" );
    }
}
