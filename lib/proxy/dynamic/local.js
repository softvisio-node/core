const Proxy = require( "../proxy" );
const IPSubnet = require( "../../ip/subnet" );
const net = require( "net" );

// supported options: controlHost, controlPort, controlPassword
module.exports = class ProxyLocal extends Proxy {
    #currentIp;
    #subnets = [];

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        super( url, options );

        url.searchParams.forEach( ( value, name ) => {
            if ( name === "ip" ) this.#subnets.push( new IPSubnet( value ) );
        } );
    }

    // TYPE
    get isLocal () {
        return true;
    }

    get type () {
        return "local";
    }

    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    // STATIC
    get isStatic () {
        return super.isStatic;
    }

    set isStatic ( isStatic ) {}

    // SESSION
    async startSession () {
        if ( !( await this._setRandomProxy() ) ) return false;

        super.isStatic = true;

        return true;
    }

    endSession () {
        super.isStatic = false;
    }

    async connect ( url ) {

        // rotate
        if ( !this.isStatic ) this._setRandomProxy();

        if ( typeof url === "string" ) url = new URL( url );

        const host = url.hostname;
        const port = url.port || this._getDefaultPort( url.protocol );

        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e ) );

            socket.once( "ready", () => {
                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( {
                host,
                port,
                "localAddress": this.#currentIp.toString(),
                "family": this.#currentIp.isV4 ? 4 : 6,
            } );
        } );
    }

    // PROTECTED
    // XXX improve, take subnet size in account
    _setRandomProxy () {
        const subnet = this.#subnets[Math.floor( Math.random() * this.#subnets.length )];

        this.#currentIp = subnet.getRandomAddr();

        this.host = this.#currentIp;

        this._clearEffectiveHost();

        return true;
    }
};
