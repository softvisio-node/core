const IS_PROXY = Symbol();
const net = require( "net" );
const http = require( "http" );
const IPAddr = require( "../ip-addr" );
const { readChunk } = require( "../util" );

const DEFAULT_PORT = {
    "ftp:": 21,
    "gopher:": 70,
    "http:": 80,
    "https:": 443,
    "ws:": 80,
    "wss:": 443,
};

const SOCKS5_ERROR = {
    "1": "General failure",
    "2": "Connection not allowed by ruleset",
    "3": "Network unreachable",
    "4": "Host unreachable",
    "5": "Connection refused by destination host",
    "6": "TTL expired",
    "7": "Command not supported / protocol error",
    "8": "Address type not supported",
};

class Proxy {
    static [IS_PROXY] = true;

    #host;
    #port;
    #username;
    #password;
    #type;
    #options = {};

    #basicAuth;

    static isProxy () {
        return this[IS_PROXY];
    }

    constructor ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        this.#host = url.hostname;
        this.#port = url.port;
        this.#username = url.username || null;
        this.#password = url.password || null;

        url.searchParams.forEach( ( value, name ) => {
            this.#options[name] = value;
        } );

        this.#type = Object.fromEntries( url.protocol
            .slice( 0, -1 )
            .split( "+" )
            .map( type => [type, true] ) );
    }

    get type () {
        return null;
    }

    get isSocks () {
        return this.#type.socks || this.#type.socks5;
    }

    get isHttp () {
        return this.#type.http;
    }

    get host () {
        return this.#host;
    }

    set host ( host ) {
        this.#host = host;
    }

    get port () {
        return this.#port;
    }

    set port ( port ) {
        this.#port = port;
    }

    get username () {
        return this.#username;
    }

    set username ( username ) {
        this.#username = username;

        this.#basicAuth = null;
    }

    get password () {
        return this.#password;
    }

    set password ( password ) {
        this.#password = password;

        this.#basicAuth = null;
    }

    get sessionId () {
        return null;
    }

    get _options () {
        return this.#options;
    }

    get basicAuth () {
        if ( this.#basicAuth == null ) {
            if ( this.#username != null ) {
                this.#basicAuth = Buffer.from( this.#username + ":" + this.#password ).toString( "base64" );
            }
            else {
                this.#basicAuth = "";
            }
        }

        return this.#basicAuth;
    }

    // METHODS
    getConnectionType ( protocol ) {
        if ( this.isHttp ) {
            if ( protocol === "http:" ) return "http";

            if ( protocol === "https:" ) return "https";
        }

        // fallback to socks5 protocol
        if ( this.isSocks ) return "socks5";
    }

    async getRemoteAddr () {
        const fetch = require( "../http/fetch" );

        const res = await fetch( "https://httpbin.org/ip", { "proxy": this } );

        if ( !res.ok ) return;

        const json = await res.json();

        return new IPAddr( json.origin );
    }

    async startSession ( options = {} ) {}

    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const type = this.getConnectionType( url.protocol );

        if ( type === "http" ) {
            return this._connectHttp( url.hostname, url.port || this._getDefaultPort( url.protocol ) );
        }
        else {
            const hostname = url.hostname;

            if ( type === "https" ) {
                return this._connectHttps( hostname, url.port || this._getDefaultPort( url.protocol ) );
            }
            else if ( type === "socks5" ) {
                return this._connectSocks5( hostname, url.port || this._getDefaultPort( url.protocol ) );
            }
            else {
                return Promise.reject( "Unable to select connection type" );
            }
        }
    }

    // PROTECTED
    async _connectHttp ( host, port ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.connectionType = "http";

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e.message ) );

            socket.once( "ready", () => {
                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( this.#port, this.#host );
        } );
    }

    async _connectHttps ( host, port ) {
        return new Promise( ( resolve, reject ) => {
            const req = http.request( {
                "method": "CONNECT",
                "protocol": "http:",
                "host": this.#host,
                "port": this.#port,
                "path": host + ":" + port,
            } );

            if ( this.basicAuth ) req.setHeader( "Proxy-Authorization", "Basic " + this.basicAuth );

            req.once( "error", e => reject( e.message ) );

            req.once( "connect", res => {
                if ( res.statusCode === 200 ) {
                    res.socket.connectionType = "https";

                    resolve( res.socket );
                }
                else {
                    reject( res.statusMessage );
                }
            } );

            req.end();
        } );
    }

    async _connectSocks5 ( host, port ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e.message || e ) );

            socket.once( "ready", async () => {

                // authenticate
                if ( this.username != null ) {
                    socket.write( Buffer.from( [0x05, 0x01, 0x02] ) );
                }

                // no authentication
                else {
                    socket.write( Buffer.from( [0x05, 0x01, 0x00] ) );
                }

                var chunk = await readChunk( socket, 2 );
                if ( !chunk ) return socket.destroy( "Connection closed" );

                // not a socks 5 proxy server
                if ( chunk[0] !== 0x05 ) return socket.destroy( "Not a socks5 proxy" );

                // no acceptable auth method found
                if ( chunk[1] === 0xff ) {
                    return socket.destroy( "No auth method supported" );
                }

                // auth is required
                else if ( chunk[1] !== 0x00 ) {

                    // username / password auth
                    if ( chunk[1] === 0x02 ) {
                        const username = Buffer.from( this.#username );
                        const password = Buffer.from( this.#password );

                        // send username / password auth
                        const buf = Buffer.concat( [

                            //
                            Buffer.from( [0x01] ),
                            Buffer.from( [username.length] ),
                            username,
                            Buffer.from( [password.length] ),
                            password,
                        ] );

                        socket.write( buf );

                        chunk = await readChunk( socket, 2 );
                        if ( !chunk ) return socket.destroy( "Connection closed" );

                        // auth rejected
                        if ( chunk[0] !== 0x01 || chunk[1] !== 0x00 ) return socket.destroy( "Authentication error" );
                    }

                    // unsupported auth method
                    else {
                        return socket.destroy( "No auth method supported" );
                    }
                }

                // create tunnel
                const ip = new IPAddr( host );

                // ipv4 address
                if ( ip.isV4 ) {
                    const buf = Buffer.alloc( 4 );
                    buf.writeUInt32BE( ip.toNumber() );

                    const portBuf = Buffer.alloc( 2 );
                    portBuf.writeUInt16BE( port );

                    socket.write( Buffer.concat( [

                        //
                        Buffer.from( [0x05, 0x01, 0x00, 0x01] ),
                        buf,
                        portBuf,
                    ] ) );
                }

                // ipv6 address
                else if ( ip.isV6 ) {

                    // TODO
                    return socket.destroy( "IPv6 currently is not supported" );
                }

                // domain name
                else {
                    const domainName = Buffer.from( host );

                    const portBuf = Buffer.alloc( 2 );
                    portBuf.writeUInt16BE( port );

                    socket.write( Buffer.concat( [

                        //
                        Buffer.from( [0x05, 0x01, 0x00, 0x03] ),
                        Buffer.from( [domainName.length] ),
                        domainName,
                        portBuf,
                    ] ) );
                }

                chunk = await readChunk( socket, 3 );
                if ( !chunk ) return socket.destroy( "Connection closed" );

                // connection error
                if ( chunk[1] !== 0x00 ) return socket.destroy( SOCKS5_ERROR[chunk[1]] || "Unknown error" );

                // read ip type
                chunk = await readChunk( socket, 1 );
                if ( !chunk ) return socket.destroy( "Connection closed" );

                // ipV4
                if ( chunk[0] === 0x01 ) {

                    // read ipV4 addr
                    chunk = await readChunk( socket, 4 );
                    if ( !chunk ) return socket.destroy( "Connection closed" );
                }

                // ipV6
                else if ( chunk[0] === 0x04 ) {

                    // read ipV6 addr
                    chunk = await readChunk( socket, 16 );
                    if ( !chunk ) return socket.destroy( "Connection closed" );
                }

                // invalid IP type
                else {
                    return socket.destroy( "Socks5 protocol error" );
                }

                // read BNDPORT
                chunk = await readChunk( socket, 2 );
                if ( !chunk ) return socket.destroy( "Connection closed" );

                // connected
                socket.connectionType = "socks5";

                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( this.#port, this.#host );
        } );
    }

    _getDefaultPort ( protocol ) {
        return DEFAULT_PORT[protocol];
    }
}

module.exports = Proxy;
