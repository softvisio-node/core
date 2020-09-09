const createProxy = require( "../proxy" );
const { getRandomFreePort } = require( "../util" );
const net = require( "net" );
const { readChunk, readLine } = require( "../util" );
const IPAddr = require( "../ip-addr" );

class ProxyServer {
    #host = "127.0.0.1";
    #port;
    #proxy;
    #auth;
    #server;

    constructor ( options = {} ) {
        this.proxy = options.proxy;

        this.#auth = options.auth;

        this.#server = net.createServer();

        this.#server.unref();
    }

    // PROPS
    get host () {
        return this.#host;
    }

    get port () {
        return this.#port;
    }

    get connectUrl () {
        return "http+socks5://" + this.#host + ":" + this.#port;
    }

    get chromeConnectUrl () {
        return "http://" + this.#host + ":" + this.#port;
    }

    get proxy () {
        return this.#proxy;
    }

    set proxy ( proxy ) {
        this.#proxy = createProxy( proxy );
    }

    // METHODS
    async listen ( port, host ) {
        if ( host ) this.#host = host;

        if ( port ) {
            this.#port = port;
        }
        else {
            this.#port = await getRandomFreePort( this.#host );
        }

        this.#server.on( "connection", this._onConnect.bind( this ) );

        this.#server.listen( this.#port, this.#host );
    }

    ref () {
        this.#server.ref();

        return this;
    }

    unref () {
        this.#server.unref();

        return this;
    }

    close ( callback ) {
        this.#server.close( callback );

        return this;
    }

    async _onConnect ( clientSocket ) {
        clientSocket.on( "error", () => {} );

        var chunk = await readChunk( clientSocket, 1 );
        if ( !chunk ) return clientSocket.end();

        // socks5 connection
        if ( chunk[0] === 0x05 ) {
            this._socks5Connection( clientSocket );
        }

        // http connection
        else {
            clientSocket.unshift( chunk );

            this._httpConnection( clientSocket );
        }
    }

    async _socks5Connection ( clientSocket ) {
        var chunk = await readChunk( clientSocket, 1 );
        if ( !chunk ) return clientSocket.end();

        const NAUTH = chunk[0];

        chunk = await readChunk( clientSocket, NAUTH );
        if ( !chunk ) return clientSocket.end();

        const authMethods = {};

        for ( const authMethod of chunk ) {
            authMethods[authMethod] = true;
        }

        // use username / password auth
        if ( authMethods[2] ) {

            // choose username/ password auth method
            clientSocket.write( Buffer.from( [0x05, 0x02] ) );

            chunk = await readChunk( clientSocket, 2 );
            if ( !chunk || chunk[0] !== 0x01 ) return clientSocket.end();

            chunk = await readChunk( clientSocket, chunk[1] );
            if ( !chunk ) return clientSocket.end();

            const username = chunk.toString();

            chunk = await readChunk( clientSocket, 1 );
            if ( !chunk ) return clientSocket.end();

            chunk = await readChunk( clientSocket, chunk[0] );
            if ( !chunk ) return clientSocket.end();

            const password = chunk.toString();

            // authorize
            if ( this.#auth ) {

                // authorize
                const auth = await this.#auth( new IPAddr( clientSocket.remoteAddress ), username, password );

                // auth error
                if ( !auth ) {

                    // reject auth
                    clientSocket.write( Buffer.from( [0x01, 0xff] ) );

                    return clientSocket.end();
                }

                // auth ok
                else {

                    // accept auth
                    clientSocket.write( Buffer.from( [0x01, 0x00] ) );
                }
            }
        }

        // no auth
        else if ( authMethods[0] ) {

            // authorize
            if ( this.#auth ) {

                // authorize
                const auth = await this.#auth( new IPAddr( clientSocket.remoteAddress ), "", "" );

                // auth failed
                if ( !auth ) {

                    // no acceptable auth methods were offered
                    clientSocket.write( Buffer.from( [0x05, 0xff] ) );

                    return clientSocket.end();
                }
            }

            // choose "no authentication" method
            clientSocket.write( Buffer.from( [0x05, 0x00] ) );
        }

        // unsupported auth method
        else {

            // no acceptable auth methods were offered
            clientSocket.write( Buffer.from( [0x05, 0xff] ) );

            return clientSocket.end();
        }

        // VER, CMD, RSV, DSTADDR_TYPE
        chunk = await readChunk( clientSocket, 4 );
        if ( !chunk || chunk[0] !== 0x05 ) return clientSocket.end();

        // not a "establish a TCP/IP stream connection" request
        if ( chunk[1] !== 0x01 ) return clientSocket.end();

        let dstAddr;

        // ipV4 addr
        if ( chunk[3] === 0x01 ) {
            chunk = await readChunk( clientSocket, 4 );
            if ( !chunk ) return clientSocket.end();

            // convert to literal ip addr
            dstAddr = new IPAddr( chunk.readUInt32BE() ).toString();
        }

        // ipv6 addr
        else if ( chunk[3] === 0x04 ) {

            // TODO currently not supported
            return clientSocket.end();
        }

        // domain name
        else if ( chunk[3] === 0x03 ) {
            const domainNameLength = await readChunk( clientSocket, 1 );
            if ( !domainNameLength ) return clientSocket.end();

            chunk = await readChunk( clientSocket, domainNameLength[0] );
            if ( !chunk ) return clientSocket.end();

            dstAddr = chunk.toString();
        }

        // invalid DSTADDR_TYPE
        else {
            return clientSocket.end();
        }

        chunk = await readChunk( clientSocket, 2 );
        if ( !chunk ) return clientSocket.end();

        const dstPort = chunk.readUInt16BE();

        // create tunnel
        let serverSocket;

        // proxied connection
        if ( this.#proxy ) {

            // socks5 connections can be proxied to socks5 upstream proxy only
            if ( this.#proxy.getConnectionType() !== "socks5" ) return clientSocket.end();

            serverSocket = await this.#proxy
                .connect( {
                    "hostname": dstAddr,
                    "port": dstPort,
                } )
                .catch( e => {} );
        }

        // direct connection
        else {
            serverSocket = await this._createDirectConnection( dstAddr, dstPort ).catch( e => {} );
        }

        if ( !serverSocket ) return clientSocket.end();

        clientSocket.write( Buffer.from( [0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00] ) );

        clientSocket.removeAllListeners();
        serverSocket.removeAllListeners();

        clientSocket.on( "error", e => serverSocket.end() );
        serverSocket.on( "error", e => clientSocket.end() );

        serverSocket.pipe( clientSocket );
        clientSocket.pipe( serverSocket );
    }

    async _httpConnection ( clientSocket ) {

        // read http headers
        let headers = await readLine( clientSocket, { "eol": "\r\n\r\n" } );
        if ( !headers ) return clientSocket.end();

        headers = headers.toString().split( "\r\n" );

        let username = "",
            password = "";

        // skip headers started with "Proxy-", chrome adds "Proxy-Connection" header
        // find Proxy-Authorization value
        headers = headers.filter( header => {

            // "Proxy-" header
            if ( header.toLowerCase().indexOf( "proxy-" ) === 0 ) {
                const auth = header.match( /^Proxy-Authorization:\s*Basic\s+(.+)/i );

                if ( auth ) {

                    // try to decode auth credentials
                    try {
                        const credentials = Buffer.from( auth[1], "base64" ).toString();

                        const idx = credentials.indexOf( ":" );

                        // no password provided
                        if ( idx === -1 ) {
                            username = credentials;
                        }
                        else {
                            username = credentials.substr( 0, idx );
                            password = credentials.substr( idx + 1 );
                        }
                    }
                    catch ( e ) {}
                }

                return false;
            }

            // other headers
            else {
                return true;
            }
        } );

        // authorize
        if ( this.#auth ) {

            // authorize
            const auth = await this.#auth( new IPAddr( clientSocket.remoteAddress ), username, password );

            // auth error
            if ( !auth ) {
                clientSocket.write( "HTTP/1.1 407 Proxy Authentication Required\r\n\r\n" );

                clientSocket.end();

                return;
            }
        }

        const method = headers[0].split( " " );

        let url;

        // https connection
        if ( method[0] === "CONNECT" ) {
            const hostPort = method[1].split( ":" );

            url = {
                "protocol": "https:",
                "hostname": hostPort[0],
                "port": hostPort[1],
            };
        }

        // http connection
        else {
            url = new URL( method[1] );
        }

        // create tunnel
        let serverSocket;

        // proxied connection
        if ( this.#proxy ) {
            serverSocket = await this.#proxy.connect( url ).catch( e => {} );
        }

        // direct connection
        else {
            serverSocket = await this._createDirectConnection( url.hostname, url.port || 80 ).catch( e => {} );
        }

        if ( !serverSocket ) return clientSocket.end();

        // incoming request is HTTP
        if ( url.protocol === "http:" ) {

            // close connection, because in keep-alive connection we can't filter next requests headers
            headers.push( "Connection: close" );

            // http -> http
            if ( serverSocket.connectionType === "http" ) {

                // replace host with this.#proxy.resolveHostname()
                if ( this.#proxy.resolve ) {
                    const ip = await this.#proxy.resolveHostname( url.hostname );

                    // unable to resolve host name
                    if ( !ip ) return clientSocket.end();

                    url.host = ip;
                    url.hostname = ip;

                    method[1] = url.toString();

                    headers[0] = method.join( " " );
                }

                // add Proxy-Authorization header if needed
                if ( this.#proxy.basicAuth ) headers.push( "Proxy-Authorization: Basic " + this.#proxy.basicAuth );
            }

            // http -> direct, http -> tunnel
            else {
                method[1] = url.pathname + url.search;

                headers[0] = method.join( " " );
            }

            serverSocket.write( headers.join( "\r\n" ) + "\r\n\r\n" );
        }

        // incoming request is HTTPs
        else {
            clientSocket.write( "HTTP/1.1 200 OK\r\n\r\n" );
        }

        clientSocket.removeAllListeners();
        serverSocket.removeAllListeners();

        clientSocket.on( "error", e => serverSocket.end() );
        serverSocket.on( "error", e => clientSocket.end() );

        serverSocket.pipe( clientSocket );
        clientSocket.pipe( serverSocket );
    }

    async _createDirectConnection ( host, port ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e ) );

            socket.once( "ready", () => {
                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( port, host );
        } );
    }
}

module.exports = ProxyServer;
