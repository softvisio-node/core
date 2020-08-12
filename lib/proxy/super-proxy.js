const IS_PROXY = Symbol();
const net = require( "net" );
const { readChunk } = require( "../util" );

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

class SuperProxy {
    static [IS_PROXY] = true;

    #host;
    #port;
    #username;
    #password;

    static isProxy () {
        return this[IS_PROXY];
    }

    constructor ( host, port, username, password ) {
        this.#host = host;
        this.#port = port;
        this.#username = username || null;
        this.#password = password || null;
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

    async _createSocks5Tunnel ( host, port ) {
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
                const ipType = net.isIP( host );

                // ipv4 address
                if ( ipType === 4 ) {

                    // TODO
                }

                // ipv6 address
                else if ( ipType === 6 ) {

                    // TODO
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

                resolve();
            } );

            socket.on( "error", e => reject( e ) );

            socket.on( "end", e => reject( e ) );
        } );
    }
}

module.exports = SuperProxy;
