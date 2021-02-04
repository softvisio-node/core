const ProxyPool = require( "./pool" );
const hola = require( "../../api/hola" );

module.exports = class ProxyHola extends ProxyPool {
    #currentIp;

    constructor ( url, options = {} ) {
        super( url, options );

        hola.on( "update", this.setProxies.bind( this ) );

        this.setProxies( hola.proxies );
    }
};
