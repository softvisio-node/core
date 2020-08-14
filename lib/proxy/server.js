const createProxy = require( "../proxy" );
const { getRandomFreePort } = require( "../util" );
const net = require( "net" );
const { readChunk, readLine } = require( "../util" );
const IPAddr = require( "../ip-addr" );

class ProxyServer {
    #host = "127.0.0.1";
    #port;
    #proxy;
    #whiteList;
    #server;

    constructor ( options = {} ) {
        this.proxy = options.proxy;

        this.whiteList = options.whiteList;

        this.#server = net.createServer();

        this.#server.unref();
    }

    get host () {
        return this.#host;
    }

    get port () {
        return this.#port;
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

    set whiteList ( whiteList ) {
        if ( !whiteList ) {
            this.#whiteList = null;
        }
        else {
            for ( const cidr of whiteList ) {
                IPAddr.addSubnet( "whitelist", cidr );
            }
        }
    }

    async listen ( port, host ) {
        if ( host ) this.#host = host;

        if ( port ) {
            this.#port = port;
        }
        else {
            this.#port = await getRandomFreePort( this.#host );
        }

        this.#server.on( "connection", async clientSocket => {
            const remoteIP = new IPAddr( clientSocket.remoteAddress );

            // check remote ip
            if ( !remoteIP.isInNet( "loopback" ) && !remoteIP.isInNet( "private" ) && remoteIP.isInNet( "whitelist" ) ) return clientSocket.end();

            var chunk = await readChunk( clientSocket, 1 );
            if ( !chunk ) return clientSocket.end();

            // socks5
            if ( chunk[0] === 0x05 ) {
                this._socks5Connection( clientSocket );
            }

            // http connection
            else {
                clientSocket.unshift( chunk );

                this._httpConnection( clientSocket );
            }
        } );

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

    async _socks5Connection ( clientSocket ) {
        var chunk = await readChunk( clientSocket, 1 );
        if ( !chunk ) return clientSocket.end();

        const NAUTH = chunk[0];

        chunk = await readChunk( clientSocket, NAUTH );
        if ( !chunk ) return clientSocket.end();

        // no auth required
        clientSocket.write( Buffer.from( [0x05, 0x00] ) );

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
            serverSocket = await this.#proxy.connect( {
                "hostname": dstAddr,
                "port": dstPort,
            } );
        }

        // direct connection
        else {
            serverSocket = net.connect( dstPort, dstAddr );
        }

        clientSocket.write( Buffer.from( [0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00] ) );

        clientSocket.on( "error", e => serverSocket.end() );
        serverSocket.on( "error", e => clientSocket.end() );

        serverSocket.pipe( clientSocket );
        clientSocket.pipe( serverSocket );
    }

    async _httpConnection ( clientSocket ) {

        // read http headers
        let headers = await readLine( clientSocket, "\r\n\r\n" );
        if ( !headers ) return clientSocket.end();

        headers = headers.toString().split( "\r\n" );

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
            serverSocket = await this.#proxy.connect( url );
        }

        // direct connection
        else {
            serverSocket = net.connect( url.port || 80, url.hostname );
        }

        // incoming request is HTTP
        if ( url.protocol === "http:" ) {

            // skip headers started with "Proxy-", chrome adds "Proxy-Connection" header
            headers = headers.filter( header => header.toLowerCase().indexOf( "proxy-" ) !== 0 );

            // close connection, because in keep-alive connection we can't filter next requests headers
            headers.push( "Connection: close" );

            // http -> http
            if ( serverSocket.connectionType === "http" ) {

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

        clientSocket.on( "error", e => serverSocket.end() );
        serverSocket.on( "error", e => clientSocket.end() );

        serverSocket.pipe( clientSocket );
        clientSocket.pipe( serverSocket );
    }
}

module.exports = ProxyServer;
