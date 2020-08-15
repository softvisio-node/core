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

    #type = {};
    #host;
    #port;
    #username;
    #password;
    #basicAuth;

    static isProxy () {
        return this[IS_PROXY];
    }

    constructor ( host, port, username, password, type ) {
        this.#host = host;
        this.#port = port;
        this.#username = username || null;
        this.#password = password || null;

        if ( type ) this.#type = Object.fromEntries( type.map( type => [type, true] ) );
    }

    get isSocks () {
        return this.#type.socks;
    }

    get isHttp () {
        return this.#type.http;
    }

    get host () {
        return this.#host;
    }

    get port () {
        return this.#port;
    }

    get username () {
        return this.#username;
    }

    get password () {
        return this.#password;
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

    _getDefaultPort ( protocol ) {
        return DEFAULT_PORT[protocol];
    }

    getConnectionType ( protocol ) {
        if ( this.isHttp ) {
            if ( protocol === "http:" ) return "http";

            if ( protocol === "https:" ) return "https";
        }

        // fallback to socks5 protocol
        if ( this.isSocks ) return "socks5";
    }

    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const type = this.getConnectionType( url.protocol );

        if ( type === "http" ) return this._connectHttp( url.hostname, url.port || this._getDefaultPort( url.protocol ) );

        if ( type === "https" ) return this._connectHttps( url.hostname, url.port || this._getDefaultPort( url.protocol ) );

        if ( type === "socks5" ) return this._connectSocks5( url.hostname, url.port || this._getDefaultPort( url.protocol ) );

        return Promise.reject( "Unable to select connection type" );
    }

    async _connectHttp ( host, port ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.connectionType = "http";

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e ) );

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

            req.once( "error", e => {
                reject( e.message );
            } );

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
            const socket = net.connect( this.#port, this.#host, async () => {

                // authenticate
                if ( this.username != null ) {
                    socket.write( Buffer.from( [0x05, 0x02, 0x00, 0x02] ) );
                }

                // no authentication
                else {
                    socket.write( Buffer.from( [0x05, 0x01, 0x00] ) );
                }

                var chunk = await readChunk( socket, 2 );
                if ( !chunk ) return resolve();

                // not a socks 5 proxy server
                if ( chunk[0] !== 0x05 ) return reject( "Not a socks5 proxy" );

                // no auth method found
                if ( chunk[1] === 0xff ) {
                    return reject( "No auth method supported" );
                }

                // username / password auth
                else if ( chunk[1] === 0x02 ) {
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

                    if ( !chunk ) return resolve();

                    if ( chunk[0] !== 0x01 || chunk[1] !== 0x00 ) return reject( "Authentication error" );
                }

                // no auth is required
                else if ( chunk[1] === 0x00 ) {

                    //
                }

                // unsupported authentication method
                else {
                    return reject( "No auth method supported" );
                }

                // establish tunnel
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
                    return reject( "IPv6 currently is not supported" );
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
                if ( !chunk ) return reject();

                // connection error
                if ( chunk[1] !== 0x00 ) return reject( SOCKS5_ERROR[chunk[1]] || "Unknown error" );

                // read ip type
                chunk = await readChunk( socket, 1 );
                if ( !chunk ) return reject();

                // ipV4
                if ( chunk[0] === 0x01 ) {

                    // read ipV4 addr
                    chunk = await readChunk( socket, 4 );
                    if ( !chunk ) return reject();
                }

                // ipV6
                else if ( chunk[0] === 0x04 ) {

                    // read ipV6 addr
                    chunk = await readChunk( socket, 16 );
                    if ( !chunk ) return reject();
                }

                // invalid IP type
                else {
                    return reject();
                }

                // read BNDPORT
                chunk = await readChunk( socket, 2 );
                if ( !chunk ) return reject();

                socket.connectionType = "socks5";

                resolve( socket );
            } );

            socket.on( "error", e => reject( e ) );

            socket.on( "end", e => reject( e ) );
        } );
    }
}

module.exports = Proxy;
