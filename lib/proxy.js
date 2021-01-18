const Proxy = require( "./proxy/proxy" );
const PROTOCOL_CLASS = {};

module.exports = function createProxy ( url ) {
    if ( !url ) return;

    // url is string
    if ( typeof url === "string" ) {
        if ( url.indexOf( "//" ) === -1 ) url = "http://" + url;

        url = new URL( url );
    }

    // url is proxy object
    else if ( url instanceof Proxy ) {
        return url;
    }

    let Class = PROTOCOL_CLASS[url.protocol];

    if ( Class == null ) {
        try {
            PROTOCOL_CLASS[url.protocol] = Class = require( "./proxy/type/" + url.protocol.slice( 0, -1 ) );
        }
        catch ( e ) {
            PROTOCOL_CLASS[url.protocol] = "";
        }
    }

    if ( !Class ) Class = Proxy;

    return new Class( url );
};
