require( "@softvisio/core" );
const net = require( "net" );
const http = require( "http" );
const IPAddr = require( "../../ip/addr" );
require( "../../stream" );

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

module.exports = Super =>
    class extends ( Super || Object ) {
        async connect ( url ) {
            if ( typeof url === "string" ) url = new URL( url );

            const requireSocks = url.protocol !== "https:" && url.protocol !== "http:";

            if ( requireSocks && !this.isSocks ) return Promise.reject( "Socks proxy is required" );

            if ( requireSocks || !this.isHttp ) {
                return this._connectSocks5( url.hostname, url.port || url.defaultPort );
            }
            else {

                // http
                if ( url.protocol === "http" ) {
                    if ( url.updateHttpRequest ) url.updateHttpRequest( this.basicAuth );

                    return this._connectHttp( url.hostname, url.port || url.defaultPort );
                }

                // https
                else {
                    return this._connectHttps( url.hostname, url.port || url.defaultPort );
                }
            }
        }

        // PROTECTED
        async _connectHttp ( hostname, port ) {
            return new Promise( ( resolve, reject ) => {
                const socket = new net.Socket();

                socket.connectionType = "http";

                socket.once( "end", () => reject( "Connection closed" ) );

                socket.once( "error", e => reject( e.message ) );

                socket.once( "ready", () => {
                    socket.removeAllListeners();

                    resolve( socket );
                } );

                socket.connect( this.port, this.hostname );
            } );
        }

        async _connectHttps ( hostname, port ) {
            return new Promise( ( resolve, reject ) => {
                const req = http.request( {
                    "method": "CONNECT",
                    "protocol": "http:",
                    "host": this.hostname,
                    "port": this.port,
                    "path": hostname + ":" + port,
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

        async _connectSocks5 ( hostname, port ) {
            return new Promise( ( resolve, reject ) => {
                const socket = new net.Socket();

                socket.once( "end", () => reject( "Connection closed" ) );

                socket.once( "error", e => reject( e.message || e ) );

                socket.once( "ready", async () => {

                    // authenticate
                    if ( this.username !== "" ) {
                        socket.write( Buffer.from( [0x05, 0x01, 0x02] ) );
                    }

                    // no authentication
                    else {
                        socket.write( Buffer.from( [0x05, 0x01, 0x00] ) );
                    }

                    var chunk = await socket.readChunk( 2 );
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
                            const username = Buffer.from( this.username );
                            const password = Buffer.from( this.password );

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

                            chunk = await socket.readChunk( 2 );
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
                    let ip;

                    try {
                        ip = new IPAddr( hostname );
                    }
                    catch ( e ) {}

                    // domain name
                    if ( !ip ) {
                        const domainName = Buffer.from( hostname );

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

                    // ipv4 address
                    else if ( ip.isV4 ) {
                        const buf = Buffer.alloc( 4 );
                        buf.writeUInt32BE( +ip.ipNum.value );

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

                    chunk = await socket.readChunk( 3 );
                    if ( !chunk ) return socket.destroy( "Connection closed" );

                    // connection error
                    if ( chunk[1] !== 0x00 ) return socket.destroy( SOCKS5_ERROR[chunk[1]] || "Unknown error" );

                    // read ip type
                    chunk = await socket.readChunk( 1 );
                    if ( !chunk ) return socket.destroy( "Connection closed" );

                    // ipV4
                    if ( chunk[0] === 0x01 ) {

                        // read ipV4 addr
                        chunk = await socket.readChunk( 4 );
                        if ( !chunk ) return socket.destroy( "Connection closed" );
                    }

                    // ipV6
                    else if ( chunk[0] === 0x04 ) {

                        // read ipV6 addr
                        chunk = await socket.readChunk( 16 );
                        if ( !chunk ) return socket.destroy( "Connection closed" );
                    }

                    // invalid IP type
                    else {
                        return socket.destroy( "Socks5 protocol error" );
                    }

                    // read BNDPORT
                    chunk = await socket.readChunk( 2 );
                    if ( !chunk ) return socket.destroy( "Connection closed" );

                    // connected
                    socket.connectionType = "socks5";

                    socket.removeAllListeners();

                    resolve( socket );
                } );

                socket.connect( this.port, this.hostname );
            } );
        }
    };
