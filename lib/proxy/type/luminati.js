const Proxy = require( "../proxy" );

const DEFAULT_HOST = "zproxy.lum-superproxy.io";
const DEFAULT_PORT = 22225;

// NOTE https://luminati.io/faq#examples

class ProxyLuminati extends Proxy {
    #username;
    #zone;
    #session;
    #country;
    #state;
    #city;
    #dns; // local - domain names will be resolved and cached by the Super Proxy, remote - DNS resolution at the Proxy Peer
    #direct; // perform the request from the super proxy directly instead of the IP of the peer

    constructor ( host, port, username, password ) {
        if ( !host ) host = DEFAULT_HOST;
        if ( !port ) port = DEFAULT_PORT;

        super( host, port, username, password );
    }

    get isHttp () {
        return true;
    }
}

module.exports = ProxyLuminati;
