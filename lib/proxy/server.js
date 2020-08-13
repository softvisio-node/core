const createProxy = require( "../proxy" );
const { getRandomFreePort } = require( "../util" );
const http = require( "http" );
const net = require( "net" );
const { readChunk } = require( "../util" );

class ProxyServer {
    #host = "127.0.0.1";
    #port;
    #proxy;
    #server;

    constructor ( proxy ) {
        this.proxy = proxy;
    }

    get host () {
        return this.#host;
    }

    get port () {
        return this.#port;
    }

    get chromeConnectUrl () {
        return "socks://" + this.#host + ":" + this.#port;
    }

    get proxy () {
        return this.#proxy;
    }

    set proxy ( proxy ) {
        this.#proxy = createProxy( proxy );
    }

    async listen ( port, host ) {
        if ( host ) this.#host = host;

        if ( port ) {
            this.#port = port;
        }
        else {
            this.#port = await getRandomFreePort( this.#host );
        }

        this.#server = net.createServer();

        this.#server.unref();

        this.#server.on( "connection", async clientSocket => {
            var chunk = await readChunk( clientSocket, 2 );
            if ( !chunk || chunk[0] !== 0x05 ) return;

            const NAUTH = chunk[1];

            chunk = await readChunk( clientSocket, NAUTH );

            // no auth required
            clientSocket.write( Buffer.from( [0x05, 0x00] ) );

            // VER, CMD, RSV, DSTADDR_TYPE
            chunk = await readChunk( clientSocket, 4 );
            if ( !chunk || chunk[0] !== 0x05 ) return;

            // not a "establish a TCP/IP stream connection" request
            if ( chunk[1] !== 0x01 ) return;

            let dstAddr;

            // ipV4 addr
            if ( chunk[3] === 0x01 ) {
                chunk = await readChunk( clientSocket, 4 );
                if ( !chunk ) return;

                // TODO convert to literal ip addr
                dstAddr = chunk.readUInt32BE();
            }

            // ipv6 addr
            else if ( chunk[3] === 0x04 ) {

                // TODO currently not supported
                return;
            }

            // domain name
            else if ( chunk[3] === 0x03 ) {
                const domainNameLength = await readChunk( clientSocket, 1 );
                if ( !domainNameLength ) return;

                chunk = await readChunk( clientSocket, domainNameLength[0] );
                if ( !chunk ) return;

                dstAddr = chunk.toString();
            }

            // invalid DSTADDR_TYPE
            else {
                return;
            }

            chunk = await readChunk( clientSocket, 2 );
            if ( !chunk ) return;

            const dstPort = chunk.readUInt16BE();

            const serverSocket = await this.#proxy.connect( {
                "hostname": dstAddr,
                "port": dstPort,
            } );

            clientSocket.write( Buffer.from( [0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00] ) );

            clientSocket.on( "error", e => serverSocket.end() );
            serverSocket.on( "error", e => clientSocket.end() );

            serverSocket.pipe( clientSocket );
            clientSocket.pipe( serverSocket );
        } );

        this.#server.listen( this.#port, this.#host );
    }

    ref () {
        this.#server.ref();
    }

    unref () {
        this.#server.unref();
    }

    async listen1 ( port, host ) {
        if ( host ) this.#host = host;

        if ( port ) {
            this.#port = port;
        }
        else {
            this.#port = await getRandomFreePort( this.#host );
        }

        this.#server = http.createServer();

        this.#server.unref();

        // proxy HTTP request
        this.#server.on( "request", ( req, res ) => {
            const clientSocket = req.client;

            const url = new URL( req.url );

            const serverSocket = net.connect( url.port || 80, url.hostname, () => {

                // compose headers
                let headers = `GET ${url.pathname}${url.search} HTTP/${req.httpVersion}\r\n`;

                for ( let j = 0; j < req.rawHeaders.length; j += 2 ) {

                    // filter headers, that contains "proxy" substring
                    if ( req.rawHeaders[j].toLowerCase().indexOf( "proxy" ) >= 0 ) continue;

                    headers += req.rawHeaders[j] + ": " + req.rawHeaders[j + 1] + "\r\n";
                }

                serverSocket.write( headers + "\r\n" );

                serverSocket.pipe( clientSocket );

                clientSocket.pipe( serverSocket );
            } );

            clientSocket.on( "error", e => serverSocket.end() );

            serverSocket.on( "error", e => clientSocket.end() );
        } );

        // proxy CONNECT method
        this.#server.on( "connect", ( req, clientSocket, head ) => {

            // Connect to an origin server
            const { port, hostname } = new URL( `http://${req.url}` );

            const serverSocket = net.connect( port || 80, hostname, () => {
                clientSocket.write( "HTTP/1.1 200 OK\r\n\r\n" );

                serverSocket.write( head );

                serverSocket.pipe( clientSocket );

                clientSocket.pipe( serverSocket );
            } );

            clientSocket.on( "error", e => serverSocket.end() );

            serverSocket.on( "error", e => clientSocket.end() );
        } );

        this.#server.listen( this.#port, this.#host );
    }
}

module.exports = ProxyServer;
