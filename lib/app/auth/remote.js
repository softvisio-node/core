const apiClient = require( "../../api/client" );

module.exports = class {
    #client;

    constructor ( app, url ) {
        this.#client = new apiClient( url );
    }
};
