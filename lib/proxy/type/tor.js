const net = require( "net" );
const Proxy = require( "../proxy" );

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9050;
const DEFAULT_CONTROL_PORT = 9051;

// supported options: controlHost, controlPort, controlPassword
class ProxyTor extends Proxy {
    constructor ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( !url.hostname ) url.hostname = DEFAULT_HOST;
        if ( !url.port ) url.port = DEFAULT_PORT;

        super( url );
    }

    get isTor () {
        return true;
    }

    get type () {
        return "tor";
    }

    get isSocks () {
        return true;
    }

    async newNym () {
        return new Promise( resolve => {
            const options = this._options;

            const socket = net.connect( options.controlPort || DEFAULT_CONTROL_PORT, options.controlHost || this.host, () => {
                socket.write( `AUTHENTICATE "${options.controlPassword || ""}"\r\nSIGNAL NEWNYM\r\nQUIT\r\n` );

                resolve();
            } );
        } );
    }
}

module.exports = ProxyTor;
