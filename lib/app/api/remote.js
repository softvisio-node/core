const apiClient = require( "../../api/client" );

module.exports = class {
    #client;

    // TODO
    constructor ( app, url ) {
        this.#client = new apiClient( url );
    }

    // TODO
    authenticatePrivate ( privateToken ) {
        return;
    }
};
