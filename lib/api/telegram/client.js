import "#lib/result";
import MtProto from "@mtproto/core";
import { sleep } from "#lib/utils";
import Counter from "#lib/threads/counter";

// NOTE https://core.telegram.org/methods

export default class TelegramClientApi {
    #apiId;
    #apiHash;
    #test;
    #mtProto;
    #shuttingDown;
    #activityCounter = new Counter();
    #phoneNumber;
    #ready = false;

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

    get phoneNumber () {
        return this.#phoneNumber;
    }

    get isReady () {
        return this.#ready;
    }

    get isShuttingDown () {
        this.#ready = false;

        return this.#shuttingDown;
    }

    // public
    async shutDown () {
        this.#shuttingDown = true;

        await this.#activityCounter.wait();

        for ( const [ dcId, rpc ] of this.#mtProto.rpcs.entries() ) {
            this.#mtProto.rpcs.delete( dcId );

            rpc.transport.socket.removeAllListeners( "close" );

            rpc.transport.socket.destroy();
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

    async call ( method, params, options = {} ) {
        if ( this.#shuttingDown ) return result( [ 400, `Telegram API is shutting down` ] );

        this.#activityCounter.value++;

        const res = await this.#call( method, params, options );

        this.#activityCounter.value--;

        return res;
    }

    async signIn ( { phoneNumber, phoneCode, password, firstName, lastName } ) {
        const res = await this.#signIn( { phoneNumber, phoneCode, password, firstName, lastName } );

        if ( res.ok ) {
            this.#ready = true;
        }
        else {
            this.#ready = false;
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
    async #call ( method, params, options = {} ) {
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

            return this.#call( method, params, options );
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

            return this.#call( method, params, options );
        }
        else {
            return res;
        }
    }

    async #signIn ( { phoneNumber, phoneCode, password, firstName, lastName } ) {
        var res,
            me = await this.getMe();

        // signed id
        if ( me.ok ) {
            return me;
        }

        // request error
        else if ( me.status !== 401 ) {
            return me;
        }

        // password is required
        else if ( me.statusText === "SESSION_PASSWORD_NEEDED" ) {
            res = await this.#checkPassword( password );

            if ( !res.ok ) return res;
        }

        // not signed in
        else {

            // phone number is not provided
            if ( !phoneNumber ) {
                return result( 401, {
                    "phoneNumberInvalid": true,
                } );
            }

            // send phone code
            res = await this.call( "auth.sendCode", {
                "phone_number": phoneNumber,
                "settings": {
                    "_": "codeSettings",
                },
            } );

            if ( !res.ok ) {
                if ( res.statusText === "PHONE_NUMBER_INVALID" ) {
                    return result( 401, {
                        "phoneNumberInvalid": true,
                    } );
                }
                else {
                    return res;
                }
            }
            else {
                this.#phoneNumber = phoneNumber;
            }

            const phoneCodeHash = res.data.phone_code_hash;

            // phone code is not provided
            if ( !phoneCode ) {
                return result( 401, {
                    "phoneCodeInvalid": true,
                } );
            }

            // sign in
            res = await this.call( "auth.signIn", {
                "phone_number": phoneNumber,
                "phone_code_hash": phoneCodeHash,
                "phone_code": phoneCode,
            } );

            if ( !res.ok ) {

                // phone code is not valid
                if ( res.statusText === "PHONE_CODE_INVALID" ) {
                    return result( 401, {
                        "phoneCodeInvalid": true,
                    } );
                }

                // password is reqired
                else if ( res.statusText === "SESSION_PASSWORD_NEEDED" ) {

                    // check password
                    res = await this.#checkPassword( password );
                    if ( !res.ok ) return res;
                }

                // request error
                else {
                    return res;
                }
            }

            // phone code pk
            else {

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
            }
        }
        return this.getMe();
    }

    async #checkPassword ( password ) {
        var res;

        res = await this.call( "account.getPassword" );

        // request error
        if ( !res.ok ) {
            return res;
        }

        // password is not required
        else if ( !res.data.has_password ) {
            return result( 200 );
        }

        // password is is not specified
        else if ( !password ) {
            return result( 401, {
                "passwordInvalid": true,
            } );
        }

        // password is required
        else {
            const { A, M1 } = await this.#mtProto.crypto.getSRPParams( {
                "g": res.data.current_algo.g,
                "p": res.data.current_algo.p,
                "salt1": res.data.current_algo.salt1,
                "salt2": res.data.current_algo.salt2,
                "gB": res.data.srp_B,
                password,
            } );

            res = await this.call( "auth.checkPassword", {
                "password": {
                    "_": "inputCheckPasswordSRP",
                    "srp_id": res.data.srp_id,
                    A,
                    M1,
                },
            } );

            // passord ok
            if ( res.ok ) {
                return result( 200 );
            }

            // password is not valid
            else if ( res.statusText === "PASSWORD_HASH_INVALID" ) {
                return result( 401, {
                    "passwordInvalid": true,
                } );
            }

            // request error
            else {
                return res;
            }
        }
    }
}
