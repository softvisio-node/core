const net = require( "net" );
const Proxy = require( "../proxy" );

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9050;
const DEFAULT_CONTROL_PORT = 9051;

// supported options: controlHost, controlPort, controlPassword
module.exports = class ProxyTor extends Proxy {
    #controlHost;
    #controlPort;
    #controlPassword;

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        url.hostname ||= DEFAULT_HOST;
        url.port ||= DEFAULT_PORT;

        super( url, options );

        this.#controlHost = options.controlHost || url.searchParams.get( "controlHost" ) || DEFAULT_HOST;
        this.#controlPort = options.controlPort || url.searchParams.get( "controlPort" ) || DEFAULT_CONTROL_PORT;
        this.#controlPassword = options.controlPassword || url.searchParams.get( "controlPassword" );
    }

    // FEATURES
    get isSocks () {
        return true;
    }

    get isStatic () {
        return false;
    }

    async newNym () {
        return new Promise( resolve => {
            const socket = net.connect( this.#controlPort, this.#controlHost, () => {
                socket.write( `AUTHENTICATE "${this.#controlPassword || ""}"\r\nSIGNAL NEWNYM\r\nQUIT\r\n` );

                resolve();
            } );
        } );
    }
};
