import "#lib/result";
import MtProto from "@mtproto/core";

export default class TelegramClientApi {
    #appId;
    #appHash;
    #storage;
    #mtProto;

    constructor ( appId, appHash, storage ) {
        this.#appId = appId;
        this.#appHash = appHash;
        this.#storage = storage;

        this.#mtProto = new MtProto( {
            "api_id": this.#appId,
            "api_hash": this.#appHash,

            "storageOptions": {
                "path": this.#storage,
            },
        } );
    }

    // properties
    get appId () {
        return this.#appId;
    }

    get appHash () {
        return this.#appHash;
    }

    // public
    async call ( method, params, options ) {
        return this.#mtProto
            .call( method, params, options )
            .then( data => result( 200, data ) )
            .catch( e => result( [ e.error_code, e.error_message ] ) );
    }
}
