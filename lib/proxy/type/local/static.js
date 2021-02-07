const mixins = require( "../../../mixins" );
const Proxy = require( "../../../proxy" );
const net = require( "net" );
const IPAddr = require( "../../../ip/addr" );
const CountryMixin = require( "../mixins/country" );
const RemoteAddrMixin = require( "../../mixins/remote-addr" );
const RemoteAddrCacheMixin = require( "../../mixins/remote-addr-cache" );

module.exports = class ProxyLocalAddr extends mixins( CountryMixin, RemoteAddrMixin, RemoteAddrCacheMixin, Proxy ) {
    #ipAddr;
    #family;

    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    get ipAddr () {
        if ( !this.#ipAddr ) this.#ipAddr = new IPAddr( this.hostname );

        return this.#ipAddr;
    }

    get family () {
        if ( !this.#family ) this.#family = net.isIP( this.hostname );

        return this.#family;
    }

    // CONNECT
    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const host = url.hostname;
        const port = url.port || url.defaultPort;

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
                "localAddress": this.hostname,
                "family": this.family,
            } );
        } );
    }
};
