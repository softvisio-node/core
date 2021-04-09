const Proxy = require( "../proxy" );
const net = require( "net" );
const dns = require( "../dns" );
require( "../stream" );
const IPAddr = require( "../ip/addr" );

module.exports = class ProxyServer extends net.Server {
    #hostname;
    #port;
    #proxy;
    #auth;
    #resolve;

    #sessionStarted;
    #bytesRead = 0;
    #bytesWritten = 0;

    constructor ( options = {} ) {
        super();

        this.#hostname = options.hostname || "127.0.0.1";
        this.#port = options.port;
        this.proxy = options.proxy;
        this.#auth = options.auth;
        this.#resolve = options.resolve;
    }

    // PROPS
    get hostname () {
        return this.#hostname;
    }

    get port () {
        return this.#port;
    }

    get httpUrl () {
        return "http://" + this.#hostname + ":" + this.#port;
    }

    get socks5Url () {
        return "socks5://" + this.#hostname + ":" + this.#port;
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

    // PUBLIC
    async listen ( port, hostname ) {
        if ( hostname ) this.#hostname = hostname;

        return new Promise( resolve => {
            this.on( "connection", this._onConnect.bind( this ) );

            this.once( "listening", () => {
                this.#port = this.address().port;

                resolve( this );
            } );

            super.listen( port || 0, this.#hostname );
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

    // PROTECTED
    async _onConnect ( clientSocket ) {
        clientSocket.on( "error", () => {} );

        var chunk = await clientSocket.readChunk( 1 );
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
        const connection = {
            "type": "socks",
            "remoteAddr": new IPAddr( clientSocket.remoteAddress ),
            "url": new URL( "socks5://" ),
        };

        var password;

        var chunk = await clientSocket.readChunk( 1 );
        if ( !chunk ) return clientSocket.end();

        const NAUTH = chunk[0];

        chunk = await clientSocket.readChunk( NAUTH );
        if ( !chunk ) return clientSocket.end();

        const authMethods = {};

        for ( const authMethod of chunk ) {
            authMethods[authMethod] = true;
        }

        // use username / password auth
        if ( authMethods[2] ) {

            // choose username / password auth method
            clientSocket.write( Buffer.from( [0x05, 0x02] ) );

            chunk = await clientSocket.readChunk( 2 );
            if ( !chunk || chunk[0] !== 0x01 ) return clientSocket.end();

            // read username
            if ( chunk[1] ) {
                chunk = await clientSocket.readChunk( chunk[1] );
                if ( !chunk ) return clientSocket.end();

                connection.username = chunk.toString();
            }

            // read passsword length
            chunk = await clientSocket.readChunk( 1 );
            if ( !chunk ) return clientSocket.end();

            // read password
            if ( chunk[0] ) {
                chunk = await clientSocket.readChunk( chunk[0] );
                if ( !chunk ) return clientSocket.end();

                password = chunk.toString();
            }

            // accept auth
            clientSocket.write( Buffer.from( [0x01, 0x00] ) );

            // reject auth
            // clientSocket.write( Buffer.from( [0x01, 0xff] ) );
            // return clientSocket.end();
        }

        // no auth
        else if ( authMethods[0] ) {

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
        chunk = await clientSocket.readChunk( 4 );
        if ( !chunk || chunk[0] !== 0x05 ) return clientSocket.end();

        // not a "establish a TCP/IP stream connection" request
        if ( chunk[1] !== 0x01 ) return clientSocket.end();

        // ipV4 addr
        if ( chunk[3] === 0x01 ) {
            chunk = await clientSocket.readChunk( 4 );
            if ( !chunk ) return clientSocket.end();

            // convert to literal ip addr
            connection.url.hostname = new IPAddr( chunk.readUInt32BE() ).toString();
        }

        // ipv6 addr
        else if ( chunk[3] === 0x04 ) {

            // TODO currently not supported
            return clientSocket.end();
        }

        // domain name
        else if ( chunk[3] === 0x03 ) {
            const domainNameLength = await clientSocket.readChunk( 1 );
            if ( !domainNameLength ) return clientSocket.end();

            chunk = await clientSocket.readChunk( domainNameLength[0] );
            if ( !chunk ) return clientSocket.end();

            connection.url.hostname = chunk.toString();
        }

        // invalid DSTADDR_TYPE
        else {
            return clientSocket.end();
        }

        // read port
        chunk = await clientSocket.readChunk( 2 );
        if ( !chunk ) return clientSocket.end();

        connection.url.port = chunk.readUInt16BE();

        // authorize
        if ( this.#auth ) {

            // authorize
            connection.auth = await this.#auth( connection, password );

            // auth error, close connection
            if ( !connection.auth ) return clientSocket.end();
        }

        // create tunnel
        let serverSocket;

        let proxy = this.#proxy;

        if ( typeof proxy === "function" ) {
            proxy = await proxy( connection );
        }

        // proxied connection
        if ( proxy ) {

            // resolve host name
            if ( this.#resolve ) {
                const hostname = await dns.resolve4( connection.url.hostname );

                // unable to resolve host name
                if ( !hostname ) return clientSocket.end();

                connection.url.hostname = hostname;
            }

            serverSocket = await proxy.connect( connection.url ).catch( e => {} );
        }

        // direct connection
        else {
            serverSocket = await this._createDirectConnection( connection.url ).catch( e => {} );
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
                connection,
                "bytesRead": serverSocket.bytesRead,
                "bytesWritten": serverSocket.bytesWritten,
            } );
        } );

        serverSocket.unref();

        serverSocket.pipe( clientSocket );
        clientSocket.pipe( serverSocket );
    }

    async _httpConnection ( clientSocket ) {
        const connection = {
            "type": "http",
            "remoteAddr": new IPAddr( clientSocket.remoteAddress ),
        };

        var password, method, headers;

        while ( 1 ) {

            // read http headers
            headers = await clientSocket.readLine( { "eol": "\r\n\r\n" } );
            if ( !headers ) return clientSocket.end();

            headers = headers.toString().split( "\r\n" );

            // parse method
            method = headers[0].split( " " );

            // https connection
            if ( method[0] === "CONNECT" ) {
                connection.url = new URL( "https://" + method[1] );
            }

            // http connection
            else {
                connection.url = new URL( method[1] );
            }

            // remove headers started with "Proxy-", chrome adds "Proxy-Connection" header
            // find Proxy-Authorization value
            headers = headers.filter( header => {

                // "Proxy-" header
                if ( header.toLowerCase().indexOf( "proxy-" ) === 0 ) {
                    const authorization = header.match( /^Proxy-Authorization:\s*Basic\s+(.+)/i );

                    if ( authorization ) {

                        // try to decode auth credentials
                        try {
                            const credentials = Buffer.from( authorization[1], "base64" ).toString();

                            const idx = credentials.indexOf( ":" );

                            // no password provided
                            if ( idx === -1 ) {
                                connection.username = credentials;
                            }
                            else {
                                connection.username = credentials.substr( 0, idx );
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
                connection.auth = await this.#auth( connection, password );

                // auth error
                if ( !connection.auth ) {
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

        // create tunnel
        let serverSocket;

        let proxy = this.#proxy;

        if ( typeof proxy === "function" ) {
            proxy = await proxy( connection );
        }

        // proxied connection
        if ( proxy ) {

            // resolve host name
            if ( this.#resolve ) {
                const hostname = await dns.resolve4( connection.url.hostname );

                // unable to resolve host name
                if ( !hostname ) return clientSocket.end();

                connection.url.hostname = hostname;
            }

            serverSocket = await proxy.connect( connection.url ).catch( e => {} );
        }

        // direct connection
        else {
            serverSocket = await this._createDirectConnection( connection.url ).catch( e => {} );
        }

        // unable to create socket
        if ( !serverSocket ) return clientSocket.end();

        // incoming request is HTTP
        if ( connection.url.protocol === "http:" ) {

            // close connection, because in keep-alive connection we can't filter next requests headers
            headers.push( "Connection: close" );

            // http -> http
            if ( serverSocket.connectionType === "http" ) {

                // replace host with ip address if "resolve" option is true
                if ( this.#resolve ) {
                    method[1] = connection.url.toString();
                }

                // add Proxy-Authorization header if needed
                if ( proxy && proxy.basicAuth ) headers.push( "Proxy-Authorization: Basic " + proxy.basicAuth );
            }

            // http -> direct, http -> tunnel
            else {
                method[1] = connection.url.pathname + connection.url.search;
            }

            headers[0] = method.join( " " );

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
                connection,
                "bytesRead": serverSocket.bytesRead,
                "bytesWritten": serverSocket.bytesWritten,
            } );
        } );

        serverSocket.unref();

        serverSocket.pipe( clientSocket );
        clientSocket.pipe( serverSocket );
    }

    async _createDirectConnection ( url ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e ) );

            socket.once( "ready", () => {
                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( url.port || url.defaultPort, url.hostname );
        } );
    }
};
