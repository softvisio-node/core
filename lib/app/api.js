const fs = require( "../fs" );
const result = require( "../result" );

module.exports = class {
    app;

    #methods = {};

    constructor ( app ) {
        this.app = app;
    }

    // TODO load / parse spec
    async load ( path ) {
        const files = await fs.readTree( path );

        for ( const file of files ) {
            const version = file.substr( 0, file.indexOf( "/" ) );

            const name = file.substr( version.length + 1 ).slice( 0, -3 );

            const Class = require( path + "/" + file );

            const object = new Class( {
                "app": this.app,
            } );

            // TODO scan methods
            this.#methods["/" + version + "/" + name + "/" + "test"] = {
                version,
                "path": name,
                "name": "/" + version + "/" + name + "/" + "test",
                "codeName": "API_test",
                object,
                "groups": {
                    "admin": true,
                    "users": false,
                },
            };
        }

        return result( 200 );
    }

    getMethod ( id ) {
        return this.#methods[id];
    }
};
