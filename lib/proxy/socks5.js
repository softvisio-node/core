const SuperProxy = require( "./super-proxy" );

class ProxySocks5 extends SuperProxy {

    // protocol, host, port
    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        return this._createSocks5Tunnel( url.hostname, url.port || this._getDefaultPort( url.protocol ) );
    }
}

module.exports = ProxySocks5;
