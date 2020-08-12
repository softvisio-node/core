const Proxy = require( "../proxy" );

class ProxySocks5 extends Proxy {
    get isSocks () {
        return true;
    }
}

module.exports = ProxySocks5;
