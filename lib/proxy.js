const Proxy = require( "./proxy/proxy" );

const PROTOCOL_CLASS = {};

module.exports = function createProxy ( url ) {

    // url is string
    if ( typeof url === "string" ) {
        url = new URL( url );
    }

    // url is proxy object
    else if ( url.constructor.isProxy && url.constructor.isProxy() ) {
        return url;
    }

    let Class = PROTOCOL_CLASS[url.protocol];

    if ( Class == null ) {
        try {
            PROTOCOL_CLASS[url.protocol] = Class = require( "./proxy/type/" + url.protocol.slice( 0, -1 ) );
        }
        catch ( e ) {
            PROTOCOL_CLASS[url.protocol] = Class = "";
        }
    }

    if ( Class ) return new Class( url.hostname, url.port, url.username, url.password );

    const type = url.protocol.slice( 0, -1 ).split( "+" );

    return new Proxy( url.hostname, url.port, url.username, url.password, type );
};
