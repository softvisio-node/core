const AuthDescriptor = require( "../auth-descriptor" );

module.exports = class {
    #app;

    constructor ( app ) {
        this.#app = app;
    }

    authenticate ( token ) {
        return new AuthDescriptor( this.#app );
    }

    authenticatePrivate ( privateToken ) {
        return new AuthDescriptor( this.#app );
    }
};
