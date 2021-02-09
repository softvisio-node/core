const mixins = require( "../../mixins" );
const Api = require( "../../api/client" );

module.exports = Super =>
    class extends mixins( Super ) {
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
