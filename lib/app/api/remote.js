const Api = require( "../../api/client" );
const EventEmitter = require( "events" );

module.exports = class extends EventEmitter {
    #client;

    constructor ( url ) {
        super();

        this.#client = new Api( url );

        this.#client.on( "close", res => {
            this._invalidateAll();
        } );

        this.#client.on( "event/invalidate-user", userId => {
            this._invalidateUser( userId );
        } );

        this.#client.on( "event/invalidate-user-token", tokenId => {
            this._invalidateUserToken( tokenId );
        } );
    }

    // TODO
    authenticate ( token ) {
        return;
    }
};
