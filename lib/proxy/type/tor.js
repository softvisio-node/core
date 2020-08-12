const net = require( "net" );
const Proxy = require( "../proxy" );

class ProxyTor extends Proxy {
    #controlHost;
    #controlPort = 9051;
    #controlPassword = "";

    constructor ( host, port, username, password ) {
        if ( !host ) host = "127.0.0.1";
        if ( !port ) port = 9050;

        super( host, port, username, password );

        this.#controlHost = host;
    }

    set controlPort ( port ) {
        this.#controlPort = port;
    }

    set controlPassword ( password ) {
        this.#controlPassword = password;
    }

    get isSocks () {
        return true;
    }

    async newNym () {
        return new Promise( resolve => {
            const socket = net.connect( this.#controlPort, this.#controlHost, () => {
                socket.write( `AUTHENTICATE "${this.controlPassword}"\r\nSIGNAL NEWNYM\r\nQUIT\r\n` );

                resolve();
            } );
        } );
    }
}

module.exports = ProxyTor;
