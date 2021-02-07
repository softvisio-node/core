const mixins = require( "../../../mixins" );
const Proxy = require( "../../../proxy" );
const net = require( "net" );

module.exports = class ProxyLocalStatic extends mixins( Proxy ) {
    #family;

    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
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

    // ROTATION
    async getProxy () {
        return this;
    }

    async getRandomProxy () {
        return this;
    }

    async rotateNextProxy () {
        return this;
    }

    async rotateRandomProxy () {
        return this;
    }
};
