module.exports = function createProxy ( url ) {

    // url is string
    if ( typeof url === "string" ) {
        url = new URL( url );
    }

    // url is proxy object
    else if ( url.constructor.isProxy && url.constructor.isProxy() ) {
        return url;
    }

    const Proxy = require( "./proxy/" + url.protocol.slice( 0, -1 ) );

    return new Proxy( url.hostname, url.port, url.username, url.password );
};
