import "#lib/result";
import MtProto from "@mtproto/core";
import { sleep } from "#lib/utils";

// NOTE https://core.telegram.org/methods

export default class TelegramClientApi {
    #apiId;
    #apiHash;
    #storage;
    #test;
    #mtProto;

    constructor ( apiId, apiHash, storage, { test } = {} ) {
        this.#apiId = apiId;
        this.#apiHash = apiHash;
        this.#storage = storage;
        this.#test = !!test;

        this.#mtProto = new MtProto( {
            "test": this.#test,
            "api_id": this.#apiId,
            "api_hash": this.#apiHash,

            "storageOptions": {
                "path": this.#storage,
            },
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
            .catch( e => result( [ e.error_code, e.error_message ] ) );

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
}
