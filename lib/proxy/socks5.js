const SuperProxy = require( "./super-proxy" );

const DEFAULT_PORT = {
    "ftp:": 21,
    "gopher:": 70,
    "http:": 80,
    "https:": 443,
    "ws:": 80,
    "wss:": 443,
};

class ProxySocks5 extends SuperProxy {
    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        return this._createSocks5Tunnel( url.hostname, url.port || DEFAULT_PORT[url.protocol] );
    }
}

module.exports = ProxySocks5;
