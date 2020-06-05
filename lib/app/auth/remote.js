const AuthDescriptor = require( "../auth-descriptor" );
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
    authenticate ( token ) {
        return new AuthDescriptor( this.#app );
    }

    // TODO
    authenticatePrivate ( privateToken ) {
        return new AuthDescriptor( this.#app );
    }
};
