const apiClient = require( "../../api/client" );

module.exports = class {
    #app;
    #client;

    // TODO
    constructor ( app, url ) {
        this.#app = app;

        this.#client = new apiClient( url );
    }

    // TODO
    authenticate ( token ) {}

    // TODO
    authenticatePrivate ( privateToken ) {}
};
