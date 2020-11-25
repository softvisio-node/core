const net = require( "net" );
const Proxy = require( "../proxy" );

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9050;
const DEFAULT_CONTROL_PORT = 9051;

// supported options: controlHost, controlPort, controlPassword
class ProxyTypeTor extends Proxy {
    #controlHost;
    #controlPort;
    #controlPassword;

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( !url.hostname ) url.hostname = DEFAULT_HOST;
        if ( !url.port ) url.port = DEFAULT_PORT;

        super( url, options );

        url.searchParams.forEach( ( value, name ) => {
            if ( !( name in options ) ) options[name] = value;
        } );

        this.#controlHost = options.controlHost || DEFAULT_HOST;
        this.#controlPort = options.controlPort || DEFAULT_CONTROL_PORT;
        this.#controlPassword = options.controlPassword;
    }

    // TYPE
    get isHola () {
        return true;
    }

    get type () {
        return "hola";
    }

    get isHttp () {
        return true;
    }

    // STATIC
    get isStatic () {
        return false;
    }

    set isStatic ( isStatic ) {}

    async newNym () {
        return new Promise( resolve => {
            const socket = net.connect( this.#controlPort, this.#controlHost, () => {
                socket.write( `AUTHENTICATE "${this.#controlPassword || ""}"\r\nSIGNAL NEWNYM\r\nQUIT\r\n` );

                resolve();
            } );
        } );
    }
}

module.exports = ProxyTypeTor;
