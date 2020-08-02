const SuperProxy = require( "./super-proxy" );

class ProxySocks5 extends SuperProxy {
    connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );
    }
}

module.exports = ProxySocks5;
