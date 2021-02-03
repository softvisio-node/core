const Proxy = require( "./proxy/proxy" );

const PROTOCOL_CLASS = {};

module.exports = function createProxy ( url, options ) {
    if ( !url ) return;

    // url is proxy object
    if ( url instanceof Proxy ) return url;

    // url is string
    if ( !( url instanceof URL ) ) {
        if ( url.indexOf( "//" ) === -1 ) url = "http://" + url;

        url = new URL( url );
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

    return new Class( url, options );
};
