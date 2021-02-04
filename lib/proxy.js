const Proxy = require( "./proxy/proxy" );

const PROTOCOL_CLASS = {
    "http:": Proxy,
    "socks:": Proxy,
    "socks5:": Proxy,
    "http+socks:": Proxy,
    "http+socks5:": Proxy,
    "socks+http:": Proxy,
    "socks5+http:": Proxy,
};

module.exports = function createProxy ( url, options ) {
    if ( !url ) return;

    // url is proxy object
    if ( url instanceof Proxy ) return url;

    // url is string
    if ( typeof url === "string" ) {
        if ( url.indexOf( "//" ) === -1 ) url = "http://" + url;

        url = new URL( url );
    }

    if ( !PROTOCOL_CLASS[url.protocol] ) PROTOCOL_CLASS[url.protocol] = require( "./proxy/type/" + url.protocol.slice( 0, -1 ) );

    return new PROTOCOL_CLASS[url.protocol]( url, options );
};
