const SuperProxy = require( "./super-proxy" );

class ProxyHttp extends SuperProxy {
    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( url.protocol === "http:" ) {
            return this._createHttpTunnel( url.hostname, url.port || this._getDefaultPort( url.protocol ) );
        }
        else if ( url.protocol === "https:" ) {
            return this._createHttpsTunnel( url.hostname, url.port || this._getDefaultPort( url.protocol ) );
        }
        else {
            throw `Unsupported protocol "${url.protocol}"`;
        }
    }
}

module.exports = ProxyHttp;
