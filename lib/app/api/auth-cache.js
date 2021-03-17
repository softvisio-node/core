const TYPES = {
    "local:": "./auth-cache/local",
    "redis:": "./auth-cache/redis",
};

module.exports = class AuthCache {
    static new ( api, url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const Type = require( TYPES[url.protocol] );

        return new Type( api, url );
    }
};
