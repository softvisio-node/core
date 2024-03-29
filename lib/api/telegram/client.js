import "#lib/result";
import MtProto from "@mtproto/core";
import { sleep } from "#lib/utils";

// NOTE https://core.telegram.org/methods

export default class TelegramClientApi {
    #apiId;
    #apiHash;
    #test;
    #mtProto;

    constructor ( apiId, apiHash, { test, storageOptions } = {} ) {
        this.#apiId = apiId;
        this.#apiHash = apiHash;
        this.#test = !!test;

        this.#mtProto = new MtProto( {
            "test": this.#test,
            "api_id": this.#apiId,
            "api_hash": this.#apiHash,
            storageOptions,
        } );
    }

    // properties
    get apiId () {
        return this.#apiId;
    }

    get apiHash () {
        return this.#apiHash;
    }

    // public
    async call ( method, params, options = {} ) {
        const res = await this.#mtProto
            .call( method, params, options )
            .then( data => result( 200, data ) )
            .catch( e => {
                if ( e.error_code ) {
                    return result( [ e.error_code, e.error_message ] );
                }
                else {
                    return result.catch( e );
                }
            } );

        if ( res.status === 420 ) {
            const seconds = Number( res.statusText.split( "FLOOD_WAIT_" )[ 1 ] );

            await sleep( seconds * 1000 );

            return this.call( method, params, options );
        }
        else if ( res.status === 303 ) {
            const [ type, dcIdAsString ] = res.statusText.split( "_MIGRATE_" );

            const dcId = Number( dcIdAsString );

            // If auth.sendCode call on incorrect DC need change default DC, because
            // call auth.signIn on incorrect DC return PHONE_CODE_EXPIRED error
            if ( type === "PHONE" ) {
                await this.#mtProto.setDefaultDc( dcId );
            }
            else {
                options = {
                    ...options,
                    dcId,
                };
            }

            return this.call( method, params, options );
        }
        else {
            return res;
        }
    }

    createTestPhoneNumber () {
        const dc = Math.floor( Math.random() * 3 ) + 1,
            phoneCode =
                dc +
                Math.floor( Math.random() * 10_000 )
                    .toString()
                    .padStart( 4, "0" );

        return {
            "phoneNumber": "+99966" + phoneCode,
            phoneCode,
        };
    }

    async signIn ( { phoneNumber, phoneCode, password, firstName, lastName } ) {
        var res;

        res = await this.getMe();

        if ( res.ok ) {

            // check password
            if ( password ) {
                const res = await this.#checkPassword( password );

                if ( !res.ok ) return res;
            }

            return res;
        }

        if ( res.status !== 401 ) return res;

        if ( !phoneNumber ) return res;

        res = await this.call( "auth.sendCode", {
            "phone_number": phoneNumber,
            "settings": {
                "_": "codeSettings",
            },
        } );
        if ( !res.ok ) return res;

        if ( !phoneCode ) return res;

        const phoneCodeHash = res.data.phone_code_hash;

        // sign in
        res = await this.call( "auth.signIn", {
            "phone_number": phoneNumber,
            "phone_code_hash": phoneCodeHash,
            "phone_code": phoneCode,
        } );
        if ( !res.ok ) return res;

        // sign up
        if ( res.data._ === "auth.authorizationSignUpRequired" ) {
            res = await this.call( "auth.signUp", {
                "phone_number": phoneNumber,
                "phone_code_hash": phoneCodeHash,
                "first_name": firstName || null,
                "last_name": lastName || null,
            } );
            if ( !res.ok ) return res;
        }

        res = await this.getMe();
        if ( !res.ok ) return res;

        // check password
        if ( password ) {
            const res = await this.#checkPassword( password );

            if ( !res.ok ) return res;
        }

        return res;
    }

    async getMe () {
        return this.call( "users.getFullUser", {
            "id": {
                "_": "inputUserSelf",
            },
        } );
    }

    // private
    async #checkPassword ( password ) {
        var res;

        res = await this.call( "account.getPassword" );
        if ( !res.ok ) return res;

        const { A, M1 } = await this.#mtProto.crypto.getSRPParams( {
            "g": res.data.current_algo.g,
            "p": res.data.current_algo.p,
            "salt1": res.data.current_algo.salt1,
            "salt2": res.data.current_algo.salt2,
            "gB": res.data.srp_B,
            password,
        } );

        return this.call( "auth.checkPassword", {
            "password": {
                "_": "inputCheckPasswordSRP",
                "srp_id": res.data.srp_id,
                A,
                M1,
            },
        } );
    }
}
