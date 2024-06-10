import "#lib/stream";

import mixins from "#lib/mixins";
import ProxyClient from "#lib/proxy/client";
import tls from "tls";
import http from "http";
import https from "https";
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
    #isHttps = false;
    #isSocks5 = false;
    #isTls = false;

    #mutex = new Mutex();

    // properties
    get protocol () {
        if ( this.#protocol == null ) {
            const types = [];

            if ( this.isHttp ) types.push( "http" );
            if ( this.isHttps ) types.push( "https" );
            if ( this.isSocks5 ) types.push( "socks5" );
            if ( this.isTls ) types.push( "tls" );

            this.#protocol = types.join( "+" ) + ":";
        }

        return this.#protocol;
    }

    get isHttp () {
        return this.#isHttp;
    }

    get isHttps () {
        return this.#isHttps;
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
            const res = await fetch( "https://httpbin.softvisio.net/ip", { "agent": { "proxy": this } } );

            if ( !res.ok ) throw Error();

            address = new IpAddress( await res.text() );

            // this.remoteAddress = address;
        }
        catch ( e ) {}

        this.#mutex.unlock( address );

        return address;
    }

    getPlaywrightProxy () {

        // impossible to connect to local proxy from playwright
        if ( this.isLocal ) return;

        // https
        if ( this.isHttps ) {
            return {
                "server": "https://" + this.hostname + ":" + this.port,
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

        // http
        else if ( this.isHttp ) {
            return {
                "server": "http://" + this.hostname + ":" + this.port,
                "username": this.username,
                "password": this.password,
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

    async connect ( url, { hostnameAddress } = {} ) {
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

        const port = url.port ? +url.port : net.getDefaultPort( url.protocol );
        if ( !port ) throw `Port is not specified`;

        // local proxy
        if ( this.isLocal ) {
            return this.#connectLocal( hostname, port );
        }

        // http: protocol
        else if ( url.protocol === "http:" ) {

            // https
            if ( this.isHttps ) {
                return this.#connectHttps( hostname, port );
            }

            // socks5
            else if ( this.isSocks5 ) {
                return this.#connectSocks5( hostname, port );
            }

            // http
            else if ( this.isHttp ) {
                return this.#connectHttp( url );
            }
        }

        // https: protocol
        else if ( url.protocol === "https:" ) {

            // https
            if ( this.isHttps ) {
                return this.#connectHttps( hostname, port );
            }

            // socks5
            else if ( this.isSocks5 ) {
                return this.#connectSocks5( hostname, port );
            }

            // http
            else if ( this.isHttp ) {
                return this.#connectHttp( url );
            }
        }

        // other protocol
        else {

            // socks5
            if ( this.isSocks5 ) {
                return this.#connectSocks5( hostname, port );
            }

            // https
            else if ( this.isHttps ) {
                return this.#connectHttps( hostname, port );
            }
        }

        // error
        throw `Unable to create proxy connection`;
    }

    // protected
    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super._init ) super._init( url, options );

        const types = new Set( super.protocol.substring( 0, super.protocol.length - 1 ).split( "+" ) );

        if ( types.has( "http" ) ) this.#isHttp = true;
        if ( types.has( "https" ) ) this.#isHttps = true;
        if ( types.has( "socks5" ) ) this.#isSocks5 = true;
        if ( types.has( "tls" ) ) this.#isTls = true;
    }

    // private
    async #connectHttp ( url ) {
        return new Promise( ( resolve, reject ) => {
            let socket;

            if ( this.isTls ) {
                socket = tls.connect( {
                    "host": this.hostname,
                    "port": this.port,
                    "servername": this.hostname,
                } );

                socket.once( "secureConnect", () => {
                    socket.removeAllListeners();

                    resolve( this.#patchHttpSocket( socket, url ) );
                } );
            }
            else {
                socket = net.connect( {
                    "host": this.hostname,
                    "port": this.port,
                } );

                socket.once( "connect", () => {
                    socket.removeAllListeners();

                    resolve( this.#patchHttpSocket( socket, url ) );
                } );
            }

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e ) );
        } );
    }

    async #connectHttps ( hostname, port ) {
        var req,
            basicAuth = this.basicAuth;

        while ( true ) {
            if ( this.isTls ) {
                req = https.request( {
                    "method": "CONNECT",
                    "hostname": this.hostname,
                    "port": this.port,
                    "path": hostname + ":" + port,
                } );
            }
            else {
                req = http.request( {
                    "method": "CONNECT",
                    "hostname": this.hostname,
                    "port": this.port,
                    "path": hostname + ":" + port,
                } );
            }

            if ( basicAuth ) req.setHeader( "Proxy-Authorization", "Basic " + basicAuth );

            const res = await new Promise( ( resolve, reject ) => {
                req.once( "error", reject );

                req.once( "connect", resolve );

                req.end();
            } );

            if ( res.statusCode === 200 ) {
                return res.socket;
            }
            else if ( res.statusCode === 407 ) {
                if ( basicAuth || !this.basicAuth ) {
                    throw res.statusMessage;
                }
                else {
                    basicAuth = this.basicAuth;
                }
            }
            else {
                throw res.statusMessage;
            }
        }
    }

    async #connectSocks5 ( hostname, port ) {
        const socket = await new Promise( ( resolve, reject ) => {
            if ( this.isTls ) {
                const socket = tls.connect( {
                    "host": this.hostname,
                    "port": this.port,
                    "servername": this.hostname,
                } );

                socket.once( "error", reject );

                socket.once( "secureConnect", () => resolve( socket ) );
            }
            else {
                const socket = net.connect( {
                    "host": this.hostname,
                    "port": this.port,
                } );

                socket.once( "error", reject );

                socket.once( "connect", () => resolve( socket ) );
            }
        } );

        // authenticate
        if ( this.username !== "" ) {
            socket.write( Buffer.from( [ 0x05, 0x01, 0x02 ] ) );
        }

        // no authentication
        else {
            socket.write( Buffer.from( [ 0x05, 0x01, 0x00 ] ) );
        }

        var chunk = await socket.readChunk( 2 ).catch( e => null );
        if ( !chunk ) return socket.destroy( "Connection closed" );

        // not a socks 5 proxy server
        if ( chunk[ 0 ] !== 0x05 ) return socket.destroy( "Not a socks5 proxy" );

        // no acceptable auth method found
        if ( chunk[ 1 ] === 0xff ) {
            return socket.destroy( "No auth method supported" );
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
                if ( !chunk ) return socket.destroy( "Connection closed" );

                // auth rejected
                if ( chunk[ 0 ] !== 0x01 || chunk[ 1 ] !== 0x00 ) return socket.destroy( "Authentication error" );
            }

            // unsupported auth method
            else {
                return socket.destroy( "No auth method supported" );
            }
        }

        // create tunnel
        let ip;

        try {
            ip = new IpAddress( hostname );
        }
        catch ( e ) {}

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
            return socket.destroy( "IPv6 currently is not supported" );
        }

        chunk = await socket.readChunk( 3 ).catch( e => null );
        if ( !chunk ) return socket.destroy( "Connection closed" );

        // connection error
        if ( chunk[ 1 ] !== 0x00 ) return socket.destroy( SOCKS5_ERROR[ chunk[ 1 ] ] || "Unknown error" );

        // read ip type
        chunk = await socket.readChunk( 1 ).catch( e => null );
        if ( !chunk ) return socket.destroy( "Connection closed" );

        // ipV4
        if ( chunk[ 0 ] === 0x01 ) {

            // read ipV4 addr
            chunk = await socket.readChunk( 4 ).catch( e => null );
            if ( !chunk ) return socket.destroy( "Connection closed" );
        }

        // ipV6
        else if ( chunk[ 0 ] === 0x04 ) {

            // read ipV6 addr
            chunk = await socket.readChunk( 16 ).catch( e => null );
            if ( !chunk ) return socket.destroy( "Connection closed" );
        }

        // invalid IP type
        else {
            return socket.destroy( "Socks5 protocol error" );
        }

        // read BNDPORT
        chunk = await socket.readChunk( 2 ).catch( e => null );
        if ( !chunk ) return socket.destroy( "Connection closed" );

        // connected
        socket.removeAllListeners();

        return socket;
    }

    async #connectLocal ( hostname, port ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e ) );

            socket.once( "connect", () => {
                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( {
                hostname,
                port,
                "localAddress": this.hostname,
                "family": this.localAddress.isIpV4 ? 4 : 6,
            } );
        } );
    }

    #patchHttpSocket ( socket, url ) {
        var write = socket._write.bind( socket ),
            buffer = "";

        const proxy = this;

        socket._write = async function ( data, encoding, callback ) {
            buffer += data.toString( encoding );

            const idx = buffer.indexOf( "\r\n\r\n" );

            // request more data
            if ( idx === -1 ) return callback();

            const headers = buffer.substring( 0, idx ).split( "\r\n" ),
                patched = {};

            let hostname = url.hostname;

            // patch headers
            for ( let n = 1; n < headers.length; n++ ) {
                const idx = headers[ n ].indexOf( ":" );

                if ( idx === -1 ) continue;

                const name = headers[ n ].substring( 0, idx ),
                    id = name.trim().toLowerCase();

                if ( id === "host" ) {
                    if ( patched[ id ] ) {
                        headers[ n ] = null;
                    }
                    else {
                        hostname = headers[ n ].substring( idx + 1 ).trim();

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

            const header = headers[ 0 ].split( " " );
            header[ 1 ] = url.protocol + "//" + hostname + ( url.port ? ":" + url.port : "" ) + header[ 1 ];
            headers[ 0 ] = header.join( " " );

            socket._write = write;

            write( headers.filter( header => header ).join( "\r\n" ) + "\r\n\r\n" + buffer.substring( idx + 4 ), encoding, callback );

            write = null;
            buffer = null;
        };

        return socket;
    }
}

ProxyClient.register( "default", ProxyClientStatic );
