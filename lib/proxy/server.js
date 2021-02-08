const Proxy = require( "../proxy" );
const net = require( "net" );
const dns = require( "../dns" );
const { readChunk, readLine } = require( "../util" );
const IPAddr = require( "../ip/addr" );

module.exports = class ProxyServer extends net.Server {
    #host = "127.0.0.1";
    #port;
    #proxy;
    #auth;
    #resolve;

    #sessionStarted;
    #bytesRead = 0;
    #bytesWritten = 0;

    constructor ( options = {} ) {
        super();

        this.proxy = options.proxy;

        this.#auth = options.auth;

        this.#resolve = options.resolve;
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

    get url () {
        return "http://" + this.#host + ":" + this.#port;
    }

    get proxy () {
        return this.#proxy;
    }

    set proxy ( value ) {
        if ( !value ) this.#proxy = null;
        else if ( typeof value === "function" ) this.#proxy = value;
        else if ( Array.isArray( value ) ) this.#proxy = Proxy.new( ...value );
        else this.#proxy = Proxy.new( value );
    }

    get resolve () {
        return this.#resolve;
    }

    set resolve ( value ) {
        this.#resolve = !!value;
    }

    // METHODS

    async listen ( port, host ) {
        if ( host ) this.#host = host;

        return new Promise( resolve => {
            this.on( "connection", this._onConnect.bind( this ) );

            this.once( "listening", () => {
                this.#port = this.address().port;

                resolve( this );
            } );

            super.listen( port || 0, this.#host );
        } );
    }

    startSession () {
        this.#sessionStarted = true;

        this.#bytesRead = 0;
        this.#bytesWritten = 0;
    }

    endSession () {
        this.#sessionStarted = false;

        const stat = {
            "bytesRead": this.#bytesRead,
            "bytesWritten": this.#bytesWritten,
        };

        this.#bytesRead = 0;
        this.#bytesWritten = 0;

        return stat;
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
        const remoteAddr = new IPAddr( clientSocket.remoteAddress );

        var username, password, auth;

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

            // choose username / password auth method
            clientSocket.write( Buffer.from( [0x05, 0x02] ) );

            chunk = await readChunk( clientSocket, 2 );
            if ( !chunk || chunk[0] !== 0x01 ) return clientSocket.end();

            // read username
            if ( chunk[1] ) {
                chunk = await readChunk( clientSocket, chunk[1] );
                if ( !chunk ) return clientSocket.end();

                username = chunk.toString();
            }

            // read passsword length
            chunk = await readChunk( clientSocket, 1 );
            if ( !chunk ) return clientSocket.end();

            // read password
            if ( chunk[0] ) {
                chunk = await readChunk( clientSocket, chunk[0] );
                if ( !chunk ) return clientSocket.end();

                password = chunk.toString();
            }

            // authorize
            if ( this.#auth ) {

                // authorize
                auth = await this.#auth( { username, password, remoteAddr, "type": "socks" } );

                // auth error
                if ( !auth ) {

                    // reject auth
                    clientSocket.write( Buffer.from( [0x01, 0xff] ) );

                    return clientSocket.end();
                }
            }

            // accept auth
            clientSocket.write( Buffer.from( [0x01, 0x00] ) );
        }

        // no auth
        else if ( authMethods[0] ) {

            // authorize
            if ( this.#auth ) {

                // authorize
                const auth = await this.#auth( { username, password, remoteAddr, "type": "socks" } );

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

        let proxy = this.#proxy;

        if ( typeof proxy === "function" ) {
            proxy = proxy( auth, {
                "type": "socks",
                remoteAddr,
                username,
                "host": dstAddr,
                "port": dstPort,
            } );
        }

        // proxied connection
        if ( proxy ) {

            // resolve host name
            if ( this.#resolve ) {
                dstAddr = await dns.resolve4( dstAddr );

                // unable to resolve host name
                if ( !dstAddr ) return clientSocket.end();
            }

            serverSocket = await proxy
                .connect( {
                    "protocol": "socks5:", // XXX currently we can only chain socks connections to the socks upstreams, because we don't know, what request type will be send (http or other). If we will know reqiest type - we can establish https tunnels for http requests, and socks tunnels for the rest.
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

        clientSocket.once( "error", e => {} );
        serverSocket.once( "error", e => {} );

        // calc sessiontraffic
        if ( this.#sessionStarted ) {
            this.#bytesRead += serverSocket.bytesRead;
            this.#bytesWritten += serverSocket.bytesWritten;

            clientSocket.on( "data", data => {
                this.#bytesWritten += data.length;
            } );

            serverSocket.on( "data", data => {
                this.#bytesRead += data.length;
            } );
        }

        clientSocket.once( "close", e => serverSocket.destroy() );
        serverSocket.once( "close", e => {
            clientSocket.destroy();

            this.emit( "stat", {
                "type": "socks",
                auth,
                remoteAddr,
                "host": dstAddr,
                "bytesRead": serverSocket.bytesRead,
                "bytesWritten": serverSocket.bytesWritten,
            } );
        } );

        serverSocket.unref();

        serverSocket.pipe( clientSocket );
        clientSocket.pipe( serverSocket );
    }

    async _httpConnection ( clientSocket ) {
        const remoteAddr = new IPAddr( clientSocket.remoteAddress );

        var username, password, auth, headers;

        while ( 1 ) {

            // read http headers
            headers = await readLine( clientSocket, { "eol": "\r\n\r\n" } );
            if ( !headers ) return clientSocket.end();

            headers = headers.toString().split( "\r\n" );

            // remove headers started with "Proxy-", chrome adds "Proxy-Connection" header
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
                auth = await this.#auth( { username, password, remoteAddr, "type": "http" } );

                // auth error
                if ( !auth ) {
                    clientSocket.write( `HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="Proxy Authentication Required"\r\n\r\n` );
                }

                // auth ok
                else {
                    break;
                }
            }

            // auth not required
            else {
                break;
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

        let proxy = this.#proxy;

        if ( typeof proxy === "function" ) {
            proxy = proxy( auth, {
                "type": "http",
                remoteAddr,
                username,
                "host": url.hostname,
            } );
        }

        // proxied connection
        if ( proxy ) {

            // resolve host name
            if ( this.#resolve ) {
                const ip = await dns.resolve4( url.hostname );

                // unable to resolve host name
                if ( !ip ) return clientSocket.end();

                url.hostname = ip;
            }

            serverSocket = await proxy.connect( url ).catch( e => {} );
        }

        // direct connection
        else {
            serverSocket = await this._createDirectConnection( url.hostname, url.port || 80 ).catch( e => {} );
        }

        // unable to create socket
        if ( !serverSocket ) return clientSocket.end();

        // incoming request is HTTP
        if ( url.protocol === "http:" ) {

            // close connection, because in keep-alive connection we can't filter next requests headers
            headers.push( "Connection: close" );

            // http -> http
            if ( serverSocket.connectionType === "http" ) {

                // replace host with ip address if "resolve" option is true
                if ( this.#resolve ) {
                    method[1] = url.toString();

                    headers[0] = method.join( " " );
                }

                // add Proxy-Authorization header if needed
                if ( proxy && proxy.basicAuth ) headers.push( "Proxy-Authorization: Basic " + proxy.basicAuth );
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

        clientSocket.once( "error", e => {} );
        serverSocket.once( "error", e => {} );

        // calc session traffic
        if ( this.#sessionStarted ) {
            this.#bytesRead += serverSocket.bytesRead;
            this.#bytesWritten += serverSocket.bytesWritten;

            clientSocket.on( "data", data => {
                this.#bytesWritten += data.length;
            } );

            serverSocket.on( "data", data => {
                this.#bytesRead += data.length;
            } );
        }

        clientSocket.once( "close", e => serverSocket.destroy() );
        serverSocket.once( "close", e => {
            clientSocket.destroy();

            this.emit( "stat", {
                "type": "http",
                auth,
                remoteAddr,
                "host": url.hostname,
                "bytesRead": serverSocket.bytesRead,
                "bytesWritten": serverSocket.bytesWritten,
            } );
        } );

        serverSocket.unref();

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
};
