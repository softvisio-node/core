const Api = require( "../../api/client" );

module.exports = class {
    #client;

    constructor ( app, url ) {
        this.#client = new Api( url );

        this.#client.on( "close", ( res ) => {
            this._invalidateAll();
        } );

        this.#client.on( "event/invalidate-user", ( userId ) => {
            this._invalidateUser( userId );
        } );

        this.#client.on( "event/invalidate-user-token", ( tokenId ) => {
            this._invalidateUserToken( tokenId );
        } );
    }

    // TODO
    _authenticatePrivate ( privateToken ) {
        return;
    }
};
