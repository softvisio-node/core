const { getRandomFreePort } = require( "../util" );
const http = require( "http" );
const net = require( "net" );
const { URL } = require( "url" );

class ProxyServer {
    host = "127.0.0.1";
    port;

    #proxy;
    #server;

    async listen ( port, host ) {
        if ( host ) this.host = host;

        if ( port ) {
            this.port = port;
        }
        else {
            this.port = await getRandomFreePort( this.host );
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

        this.#server.listen( this.port, this.host );
    }

    getConnectUrl () {
        return "http://" + this.host + ":" + this.port;
    }

    // TODO convert string to proxy object
    setProxy ( proxy ) {
        this.#proxy = proxy;
    }
}

module.exports = ProxyServer;
