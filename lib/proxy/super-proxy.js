const IS_PROXY = Symbol();
const net = require( "net" );

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

    async _readChunk ( stream, size ) {
        if ( stream.readableLength >= size ) {
            return stream.read( size );
        }
        else {
            return new Promise( resolve => {
                stream.on( "end", function onEnd () {
                    resolve();
                } );

                stream.on( "readable", function onReadable () {
                    if ( stream.readableLength >= size ) {

                        // stream.off( onEnd );
                        // stream.off( onReadable );

                        resolve( stream.read( size ) );
                    }
                } );
            } );
        }
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

                var chunk = await this._readChunk( socket, 2 );
                if ( !chunk ) return resolve();

                // not a socks 5 proxy server
                if ( chunk[0] !== 0x05 ) return reject( "Not a socks5 proxy" );

                // no auth method found
                if ( chunk[1] === 0xff ) {
                    return reject( "No auth method supported" );
                }

                // username / password auth
                else if ( chunk[1] === 0x02 ) {

                    // send authentication
                    var bb = Buffer.concat( [Buffer.from( [0x01] ), Buffer.from( [this.#username.length] ), Buffer.from( this.#username ), Buffer.from( [this.#password.length] ), Buffer.from( this.#password )] );
                    console.log( bb );

                    socket.write( bb );
                    console.log( 123 );
                    chunk = await this._readChunk( socket, 2 );
                    console.log( chunk );

                    if ( !chunk ) return resolve();

                    if ( chunk[1] !== 0x00 ) return reject( "Authentication error" );
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

                console.log( ipType );

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
                    socket.write( Buffer.from( [0x05, 0x01, 0x00, 0x03] ), host.length, host, port );
                }

                chunk = await this._readChunk( socket, 4 );
                if ( !chunk ) return resolve();
            } );

            socket.on( "error", e => reject( e ) );

            socket.on( "end", e => reject( e ) );
        } );
    }
}

module.exports = SuperProxy;
