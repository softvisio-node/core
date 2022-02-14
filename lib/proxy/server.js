import "#lib/stream";

import ProxyClient from "#lib/proxy/client";
import net from "net";
import IpAddr from "#lib/ip/addr";
import { getDefaultPort } from "#lib/utils/net";

export default class ProxyServer extends net.Server {
    #hostname;
    #port;
    #proxy;
    #auth;

    #sessionStarted;
    #bytesRead = 0;
    #bytesWritten = 0;

    // auth: async ( connection, password )
    // proxy: async ( connection )
    constructor ( { hostname, port, proxy, auth } = {} ) {
        super();

        this.#hostname = hostname || "127.0.0.1";
        this.#port = port || 0;
        this.proxy = proxy;
        this.#auth = auth;
    }

    // properties
    get hostname () {
        return this.#hostname;
    }

    get port () {
        return this.#port;
    }

    get proxy () {
        return this.#proxy;
    }

    set proxy ( value ) {
        if ( !value ) this.#proxy = null;
        else if ( typeof value === "function" ) this.#proxy = value;
        else if ( Array.isArray( value ) ) this.#proxy = ProxyClient.new( ...value );
        else this.#proxy = ProxyClient.new( value );
    }

    // public
    async listen ( { hostname, port } = {} ) {
        port ||= this.#port;

        if ( hostname ) this.#hostname = hostname;

        return new Promise( resolve => {
            this.on( "connection", this.#onConnect.bind( this ) );

            this.once( "listening", () => {
                this.#port = this.address().port;

                resolve( this );
            } );

            super.listen( port, this.#hostname );
        } );
    }

    async getPlaywrightProxy ( options = {} ) {
        options = { ...options, "hostname": this.#hostname, "port": this.#port };

        return ProxyClient.new( "softvisio://", options ).getPlaywrightProxy();
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

    // protected
    async #onConnect ( clientSocket ) {
        var chunk = await clientSocket.readChunk( 1 ).catch( e => null );
        if ( !chunk ) return clientSocket.end();

        // socks5 connection
        if ( chunk[0] === 0x05 ) {
            this.#socks5Connection( clientSocket );
        }

        // http connection
        else {
            clientSocket.unshift( chunk );

            this.#httpConnection( clientSocket );
        }
    }

    async #socks5Connection ( clientSocket ) {
        const connection = {
            "type": "socks",
            "remoteAddr": new IpAddr( clientSocket.remoteAddress ),
            "url": new URL( "socks5://" ),
            "options": {},
        };

        var password;

        var chunk = await clientSocket.readChunk( 1 ).catch( e => null );
        if ( !chunk ) return clientSocket.end();

        const NAUTH = chunk[0];

        chunk = await clientSocket.readChunk( NAUTH ).catch( e => null );
        if ( !chunk ) return clientSocket.end();

        const authMethods = {};

        for ( const authMethod of chunk ) {
            authMethods[authMethod] = true;
        }

        // use username / password auth
        if ( authMethods[2] ) {

            // choose username / password auth method
            clientSocket.write( Buffer.from( [0x05, 0x02] ) );

            chunk = await clientSocket.readChunk( 2 ).catch( e => null );
            if ( !chunk || chunk[0] !== 0x01 ) return clientSocket.end();

            // read username
            if ( chunk[1] ) {
                chunk = await clientSocket.readChunk( chunk[1] ).catch( e => null );
                if ( !chunk ) return clientSocket.end();

                connection.options = this.#parseUsername( chunk.toString() );
            }

            // read passsword length
            chunk = await clientSocket.readChunk( 1 ).catch( e => null );
            if ( !chunk ) return clientSocket.end();

            // read password
            if ( chunk[0] ) {
                chunk = await clientSocket.readChunk( chunk[0] ).catch( e => null );
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

        // ver, cmd, rsv, dstaddr_type
        chunk = await clientSocket.readChunk( 4 ).catch( e => null );
        if ( !chunk || chunk[0] !== 0x05 ) return clientSocket.end();

        // not a "establish a TCP/IP stream connection" request
        if ( chunk[1] !== 0x01 ) return clientSocket.end();

        // ipV4 addr
        if ( chunk[3] === 0x01 ) {
            chunk = await clientSocket.readChunk( 4 ).catch( e => null );
            if ( !chunk ) return clientSocket.end();

            // convert to literal ip addr
            connection.url.hostname = new IpAddr( chunk.readUInt32BE() ).toString();
        }

        // ipv6 addr
        else if ( chunk[3] === 0x04 ) {

            // TODO currently not supported
            return clientSocket.end();
        }

        // domain name
        else if ( chunk[3] === 0x03 ) {
            const domainNameLength = await clientSocket.readChunk( 1 ).catch( e => null );
            if ( !domainNameLength ) return clientSocket.end();

            chunk = await clientSocket.readChunk( domainNameLength[0] ).catch( e => null );
            if ( !chunk ) return clientSocket.end();

            connection.url.hostname = chunk.toString();
        }

        // invalid DSTADDR_TYPE
        else {
            return clientSocket.end();
        }

        // read port
        chunk = await clientSocket.readChunk( 2 ).catch( e => null );
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
            serverSocket = await proxy.connect( connection.url, connection.options ).catch( e => {} );
        }

        // direct connection
        else {
            serverSocket = await this.#createDirectConnection( connection.url ).catch( e => {} );
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

    async #httpConnection ( clientSocket ) {
        const connection = {
            "type": "http",
            "remoteAddr": new IpAddr( clientSocket.remoteAddress ),
            "options": {},
        };

        var password, method, headers;

        // read http headers
        headers = await clientSocket.readHttpHeaders().catch( e => null );
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
                            connection.options = this.#parseUsername( credentials );
                        }
                        else {
                            connection.options = this.#parseUsername( credentials.substring( 0, idx ) );
                            password = credentials.substring( idx + 1 );
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

                return clientSocket.end();
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
            serverSocket = await proxy
                .connect( connection.url, connection.options, _options => {

                    // add Proxy-Authorization header if needed
                    if ( _options ) {
                        if ( _options.http ) {

                            // replace hostname with ip addr
                            if ( _options.hostname ) {
                                const url = new URL( connection.url );
                                url.hostname = _options.hostname;
                                method[1] = url.toString();
                            }

                            if ( _options.auth ) headers.push( "Proxy-Authorization: Basic " + _options.auth );
                        }
                    }
                } )
                .catch( e => {} );
        }

        // direct connection
        else {
            serverSocket = await this.#createDirectConnection( connection.url ).catch( e => {} );
        }

        // unable to create socket
        if ( !serverSocket ) return clientSocket.end();

        // incoming request is HTTP
        if ( connection.url.protocol === "http:" ) {

            // close connection, because in keep-alive connection we can't filter next requests headers
            headers.push( "Connection: close" );

            // http -> direct, http -> tunnel
            if ( serverSocket.proxyConnectionType !== "http" ) {
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

    async #createDirectConnection ( url ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e ) );

            socket.once( "ready", () => {
                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( url.port || getDefaultPort( url.protocol ), url.hostname );
        } );
    }

    #parseUsername ( username ) {
        if ( !username ) return {};

        const data = {};

        const params = username.split( "," );

        data.username = params.shift();

        for ( const param of params ) {
            const idx = param.indexOf( "-" );

            // invalid parameter, can't start with "-"
            if ( !idx ) continue;

            if ( idx === -1 ) {
                data[param] = true;
            }
            else {
                const name = param.substring( 0, idx ),
                    value = param.substring( idx + 1 );

                data[name] = value;
            }
        }

        return data;
    }
}
