import "#lib/stream";
import mixins from "#lib/mixins";
import ProxyClient from "#lib/proxy/client";
import tls from "node:tls";
import IpAddress from "#lib/ip/address";
import fetch from "#lib/fetch";
import Mutex from "#lib/threads/mutex";
import { resolve4 } from "#lib/dns";
import net from "#lib/net";

import OptionsCountry from "../mixins/country.js";
import OptionsRemoteAddress from "../mixins/remote-address.js";
import OptionsLocalAddress from "../mixins/local-address.js";

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

export default class ProxyClientStatic extends mixins( OptionsCountry, OptionsRemoteAddress, OptionsLocalAddress, ProxyClient ) {
    #protocol;
    #isHttp = false;
    #isSocks5 = false;
    #isTls = false;

    #mutex = new Mutex();

    // properties
    get protocol () {
        if ( this.#protocol == null ) {
            const types = [];

            if ( this.isHttp ) types.push( "http" );
            if ( this.isSocks5 ) types.push( "socks5" );
            if ( this.isTls ) types.push( "tls" );

            this.#protocol = types.join( "+" ) + ":";
        }

        return this.#protocol;
    }

    get isHttp () {
        return this.#isHttp;
    }

    get isSocks5 () {
        return this.#isSocks5;
    }

    get isTls () {
        return this.#isTls;
    }

    // public
    async getRemoteAddress () {
        if ( this.remoteAddress ) return this.remoteAddress;

        if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

        var address;

        try {
            const res = await fetch( "https://httpbin.softvisio.net/ip", {
                "dispatcher": new fetch.Dispatcher( {
                    "proxy": this,
                } ),
            } );

            if ( !res.ok ) throw new Error();

            address = new IpAddress( await res.text() );

            // this.remoteAddress = address;
        }
        catch {}

        this.#mutex.unlock( address );

        return address;
    }

    getPlaywrightProxy () {

        // impossible to connect to local proxy from playwright
        if ( this.isLocal ) return;

        // http
        if ( this.isHttp ) {
            return {
                "server": ( this.isTls
                    ? "https://"
                    : "http://" ) + this.hostname + ":" + this.port,
                "username": this.username,
                "password": this.password,
            };
        }

        // socks5
        else if ( this.isSocks5 && !this.username && !this.password ) {
            return {
                "server": "socks5://" + this.hostname + ":" + this.port,
            };
        }
    }

    getProxy () {
        return this;
    }

    getNextProxy () {
        return this;
    }

    getRandomProxy () {
        return this;
    }

    async connect ( url, { hostnameAddress, connectTimeout, checkCertificate = true } = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        var hostname;

        if ( this.resolve ) {
            if ( hostnameAddress ) {
                hostname = hostnameAddress;
            }
            else {
                hostname = await resolve4( hostname );

                if ( !hostname ) return Promise.reject( "Unable to resolve hostname" );
            }
        }
        else {
            hostname = url.hostname;
        }

        const port = url.port
            ? +url.port
            : net.getDefaultPort( url.protocol );
        if ( !port ) throw `Port is not specified`;

        // local proxy
        if ( this.isLocal ) {
            return this.#connect( {
                connectTimeout,
                "tls": this.isTls,
                "servername": hostname,
                "rejectUnauthorized": !!checkCertificate,
                "host": hostname,
                port,
                "localAddress": this.hostname,
                "family": this.localAddress.isIpV4
                    ? 4
                    : 6,
            } );
        }

        // http: protocol
        else if ( url.protocol === "http:" ) {

            // http
            if ( this.isHttp ) {
                return this.#connectHttp( {
                    connectTimeout,
                    checkCertificate,
                    url,
                } );
            }

            // socks5
            else if ( this.isSocks5 ) {
                return this.#connectSocks5( {
                    connectTimeout,
                    checkCertificate,
                    hostname,
                    port,
                } );
            }
        }

        // https: protocol
        else if ( url.protocol === "https:" ) {

            // https
            if ( this.isHttp ) {
                return this.#connectHttps( {
                    connectTimeout,
                    checkCertificate,
                    hostname,
                    port,
                } );
            }

            // socks5
            else if ( this.isSocks5 ) {
                return this.#connectSocks5( {
                    connectTimeout,
                    checkCertificate,
                    hostname,
                    port,
                } );
            }
        }

        // other protocol
        else {

            // socks5
            if ( this.isSocks5 ) {
                return this.#connectSocks5( {
                    connectTimeout,
                    checkCertificate,
                    hostname,
                    port,
                } );
            }

            // https
            else if ( this.isHttp ) {
                return this.#connectHttps( {
                    connectTimeout,
                    checkCertificate,
                    hostname,
                    port,
                } );
            }
        }

        // error
        throw `Unable to create proxy connection`;
    }

    // protected
    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super._init ) super._init( url, options );

        const types = new Set( super.protocol.slice( 0, -1 ).split( "+" ) );

        if ( types.has( "http" ) ) this.#isHttp = true;
        if ( types.has( "socks5" ) ) this.#isSocks5 = true;
        if ( types.has( "tls" ) ) this.#isTls = true;
    }

    // private
    async #connectHttp ( { url, connectTimeout, checkCertificate } ) {
        return this.#connect(
            {
                connectTimeout,
                "tls": this.isTls,
                "servername": this.hostname,
                "rejectUnauthorized": !!checkCertificate,
                "host": this.hostname,
                "port": this.port,
            },
            socket => this.#patchHttpSocket( socket, url )
        );
    }

    async #connectHttps ( { hostname, port, connectTimeout, checkCertificate } ) {
        return this.#connect(
            {
                connectTimeout,
                "tls": this.isTls,
                "servername": this.hostname,
                "rejectUnauthorized": !!checkCertificate,
                "host": this.hostname,
                "port": this.port,
            },
            async socket => {
                const req = [

                    //
                    `CONNECT ${ hostname }:${ port } HTTP/1.1\r\n`,
                    `Host: ${ this.hostname }\r\n`,
                ];

                if ( this.basicAuth ) req.push( `Proxy-Authorization: Basic ${ this.basicAuth }\r\n` );

                req.push( "\r\n" );

                socket.write( req.join( "" ) );

                var headers = await socket.readHttpHeaders();
                if ( !headers ) throw "HTTP headers error";

                headers = headers.split( "\r\n" )[ 0 ].split( " " );

                const status = +headers[ 1 ],
                    statusText = headers.slice( 2 ).join( " " );

                if ( status === 200 ) {
                    return;
                }
                else {
                    throw statusText;
                }
            }
        );
    }

    async #connectSocks5 ( { hostname, port, connectTimeout, checkCertificate } ) {
        return this.#connect(
            {
                connectTimeout,
                "tls": this.isTls,
                "servername": this.hostname,
                "rejectUnauthorized": !!checkCertificate,
                "host": this.hostname,
                "port": this.port,
            },
            socket => this.#createSocks5Tunnel( socket, hostname, port )
        );
    }

    async #createSocks5Tunnel ( socket, hostname, port ) {

        // authenticate
        if ( this.username !== "" ) {
            socket.write( Buffer.from( [ 0x05, 0x01, 0x02 ] ) );
        }

        // no authentication
        else {
            socket.write( Buffer.from( [ 0x05, 0x01, 0x00 ] ) );
        }

        var chunk = await socket.readChunk( 2 ).catch( e => null );
        if ( !chunk ) throw "Connection closed";

        // not a socks 5 proxy server
        if ( chunk[ 0 ] !== 0x05 ) throw "Not a socks5 proxy";

        // no acceptable auth method found
        if ( chunk[ 1 ] === 0xFF ) {
            throw "No auth method supported";
        }

        // auth is required
        else if ( chunk[ 1 ] !== 0x00 ) {

            // username / password auth
            if ( chunk[ 1 ] === 0x02 ) {
                const username = Buffer.from( this.username );
                const password = Buffer.from( this.password );

                // send username / password auth
                const buf = Buffer.concat( [

                    //
                    Buffer.from( [ 0x01 ] ),
                    Buffer.from( [ username.length ] ),
                    username,
                    Buffer.from( [ password.length ] ),
                    password,
                ] );

                socket.write( buf );

                chunk = await socket.readChunk( 2 ).catch( e => null );
                if ( !chunk ) throw "Connection closed";

                // auth rejected
                if ( chunk[ 0 ] !== 0x01 || chunk[ 1 ] !== 0x00 ) {
                    throw "Proxy authentication error";
                }
            }

            // unsupported auth method
            else {
                throw "Proxy authentication method is not supported";
            }
        }

        // create tunnel
        let ip;

        try {
            ip = new IpAddress( hostname );
        }
        catch {}

        // domain name
        if ( !ip ) {
            const domainName = Buffer.from( hostname );

            const portBuf = Buffer.alloc( 2 );
            portBuf.writeUInt16BE( port );

            socket.write( Buffer.concat( [

                //
                Buffer.from( [ 0x05, 0x01, 0x00, 0x03 ] ),
                Buffer.from( [ domainName.length ] ),
                domainName,
                portBuf,
            ] ) );
        }

        // ipv4 address
        else if ( ip.isIpV4 ) {
            const buf = Buffer.alloc( 4 );
            buf.writeUInt32BE( ip.value );

            const portBuf = Buffer.alloc( 2 );
            portBuf.writeUInt16BE( port );

            socket.write( Buffer.concat( [

                //
                Buffer.from( [ 0x05, 0x01, 0x00, 0x01 ] ),
                buf,
                portBuf,
            ] ) );
        }

        // ipv6 address
        else if ( ip.isIpV6 ) {

            // TODO
            throw "IPv6 currently is not supported";
        }

        chunk = await socket.readChunk( 3 ).catch( e => null );
        if ( !chunk ) throw "Connection closed";

        // connection error
        if ( chunk[ 1 ] !== 0x00 ) throw SOCKS5_ERROR[ chunk[ 1 ] ] || "Unknown error";

        // read ip type
        chunk = await socket.readChunk( 1 ).catch( e => null );
        if ( !chunk ) throw "Connection closed";

        // ipV4
        if ( chunk[ 0 ] === 0x01 ) {

            // read ipV4 addr
            chunk = await socket.readChunk( 4 ).catch( e => null );
            if ( !chunk ) throw "Connection closed";
        }

        // ipV6
        else if ( chunk[ 0 ] === 0x04 ) {

            // read ipV6 addr
            chunk = await socket.readChunk( 16 ).catch( e => null );
            if ( !chunk ) throw "Connection closed";
        }

        // invalid IP type
        else {
            throw "Socks5 protocol error";
        }

        // read BNDPORT
        chunk = await socket.readChunk( 2 ).catch( e => null );
        if ( !chunk ) throw "Connection closed";

        // connected
        socket.removeAllListeners();

        return socket;
    }

    async #connect ( { connectTimeout, "tls": useTls, ...options } = {}, onConnect ) {
        var socket, error, timeout, callback;

        if ( connectTimeout ) {
            timeout = setTimeout( () => socket.destroy( "Connection timeout" ), connectTimeout );
        }

        await new Promise( ( resolve, reject ) => {
            callback = e => {

                // connection error
                if ( e ) {
                    reject( e );
                }

                // connected
                else {
                    resolve();
                }
            };

            if ( useTls ) {
                socket = tls.connect( options, callback );
            }
            else {
                socket = net.connect( options, callback );
            }

            socket.once( "error", callback );
        } ).catch( e => {
            error = e;
        } );

        socket.off( "error", callback );
        socket.off( useTls
            ? "secureConnect"
            : "connect", callback );

        if ( error ) throw error;
        if ( socket.destroyed ) throw "Connection closed";

        if ( onConnect ) {
            callback = e => {
                error = e;
            };

            socket.once( "error", callback );

            try {
                await onConnect( socket );
            }
            catch ( e ) {
                error = e;

                socket.destroy();
            }

            socket.off( "error", callback );
        }

        clearTimeout( timeout );

        if ( error ) throw error;
        if ( socket.destroyed ) throw "Connection closed";

        return socket;
    }

    #patchHttpSocket ( socket, url ) {
        var write = socket._write.bind( socket ),
            buffer = "";

        const proxy = this;

        socket._write = async function ( chunk, encoding, callback ) {
            buffer += chunk.toString( "latin1" );

            const idx = buffer.indexOf( "\r\n\r\n" );

            // headers block not found
            if ( idx === -1 ) {

                // max. headers length reached
                if ( buffer.length > 4096 ) {
                    this.destroy( `Max. HTTP headers length reached` );
                }

                // request more data
                else {
                    callback();
                }

                return;
            }

            const headers = buffer.slice( 0, idx ).split( "\r\n" ),
                patched = {},
                header = headers[ 0 ].split( " " );
            if ( !header[ 2 ]?.toLowerCase().startsWith( "http/" ) ) {
                this.destroy( `HTTP protocol error` );

                return;
            }

            let hostname = url.hostname;

            // patch headers
            for ( let n = 1; n < headers.length; n++ ) {
                const idx = headers[ n ].indexOf( ":" );

                if ( idx === -1 ) continue;

                const name = headers[ n ].slice( 0, idx ),
                    id = name.trim().toLowerCase();

                if ( id === "host" ) {
                    if ( patched[ id ] ) {
                        headers[ n ] = null;
                    }
                    else {
                        hostname = headers[ n ].slice( idx + 1 ).trim();

                        headers[ n ] = name + ": " + proxy.hostname;
                    }
                }
                else if ( id === "connection" ) {
                    if ( patched[ id ] ) {
                        headers[ n ] = null;
                    }
                    else {
                        headers[ n ] = "Connection: close";
                    }
                }
                else if ( id === "proxy-authorization" ) {
                    if ( patched[ id ] ) {
                        headers[ n ] = null;
                    }
                    else {
                        if ( proxy.basicAuth ) {
                            headers[ n ] = "Proxy-Authorization: Basic " + proxy.basicAuth;
                        }
                        else {
                            headers[ n ] = null;
                        }
                    }
                }

                patched[ id ] = true;
            }

            if ( !patched[ "host" ] ) {
                headers.push( "Host: " + proxy.hostname );
            }

            if ( !patched[ "connection" ] ) {
                headers.push( "Connection: close" );
            }

            if ( proxy.basicAuth && !patched[ "proxy-authorization" ] ) {
                headers.push( "Proxy-Authorization: Basic " + proxy.basicAuth );
            }

            header[ 1 ] = url.protocol + "//" + hostname + ( url.port
                ? ":" + url.port
                : "" ) + header[ 1 ];
            headers[ 0 ] = header.join( " " );

            socket._write = write;

            write( headers.filter( header => header ).join( "\r\n" ) + "\r\n\r\n" + buffer.slice( idx + 4 ), encoding, callback );

            write = null;
            buffer = null;
        };
    }
}

ProxyClient.register( "http:", ProxyClientStatic );
ProxyClient.register( "http+tls:", ProxyClientStatic );
ProxyClient.register( "socks5:", ProxyClientStatic );
ProxyClient.register( "socks5+tls:", ProxyClientStatic );
ProxyClient.register( "http+socks5:", ProxyClientStatic );
ProxyClient.register( "http+socks5+tls:", ProxyClientStatic );
