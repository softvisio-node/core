const Proxy = require( "../proxy" );
const Tor = require( "../../api/tor" );

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9050;
const DEFAULT_CONTROL_PORT = 9051;

// supported options: controlHost, controlPort, controlPassword
module.exports = class ProxyTor extends Proxy {
    #toString;
    #controlHost;
    #controlPort;
    #controlPassword;
    #tor;

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        url.hostname ||= DEFAULT_HOST;
        url.port ||= DEFAULT_PORT;

        super( url, options );

        this.#controlHost = options.controlHost || url.searchParams.get( "controlHost" ) || DEFAULT_HOST;
        this.#controlPort = options.controlPort || url.searchParams.get( "controlPort" ) || DEFAULT_CONTROL_PORT;
        this.#controlPassword = options.controlPassword || url.searchParams.get( "controlPassword" );

        this.#tor = new Tor( this.#controlHost, this.#controlPort, this.#controlPassword );
    }

    // FEATURES
    get isSocks () {
        return true;
    }

    get isStatic () {
        return false;
    }

    toString () {
        if ( !this.#toString ) {
            const url = this._url;

            if ( this.#controlHost ) url.searchParams.set( "controlHost", this.#controlHost );
            if ( this.#controlPort ) url.searchParams.set( "controlPort", this.#controlPort );
            if ( this.#controlPassword ) url.searchParams.set( "controlPassword", this.#controlPassword );

            this.#toString = url.toString();
        }

        return this.#toString;
    }

    // XXX wait for newnym ready
    async rotate () {
        return new Promise( resolve => {
            this.#tor.newNym();

            // this.#tor.once( "CIRC", data => {
            //     console.log( data );

            //     if ( data[1] === "CLOSED" ) resolve();
            // } );

            resolve();
        } );
    }
};
