import "#lib/result";
import MtProto from "@mtproto/core";

export default class TelegramClientApi {
    #apiId;
    #apiHash;
    #storage;
    #mtProto;

    constructor ( apiId, apiHash, storage ) {
        this.#apiId = apiId;
        this.#apiHash = apiHash;
        this.#storage = storage;

        this.#mtProto = new MtProto( {
            "api_id": this.#apiId,
            "api_hash": this.#apiHash,

            "storageOptions": {
                "path": this.#storage,
            },
        } );
    }

    // properties
    get appId () {
        return this.#apiId;
    }

    get appHash () {
        return this.#apiHash;
    }

    // public
    async call ( method, params, options ) {
        return this.#mtProto
            .call( method, params, options )
            .then( data => result( 200, data ) )
            .catch( e => result( [ e.error_code, e.error_message ] ) );
    }
}
