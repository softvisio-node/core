const Api = require( "../../api/client" );

module.exports = class {
    #client;

    constructor ( app, url ) {
        this.#client = new Api( {
            url,
            onDisconnect ( res ) {
                this.invalidateAll();
            },
            onEvent ( name, args ) {
                if ( name === "invalidate-user" ) {
                    this.invalidateUser( args[0] );
                }
                else if ( name === "invalidate-user-token" ) {
                    this.invalidateUserToken( args[0] );
                }
            },
        } );
    }

    // TODO
    authenticatePrivate ( privateToken ) {
        return;
    }
};
