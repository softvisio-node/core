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
    #isHttp = false;
    #isSocks = false;
    #isSecure = false;

    #mutex = new Mutex();

    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super._init ) super._init( url, options );

        if ( this.protocol === "http:" ) {
            this.#isHttp = true;
        }
        else if ( this.protocol === "https:" ) {
            this.#isHttp = true;
            this.#isSecure = true;
        }
        else if ( this.protocol === "socks5:" ) {
            this.#isSocks = true;
        }
        else if ( this.protocol === "socks5s:" ) {
            this.#isSocks = true;
            this.#isSecure = true;
        }
    }

    // props
    get isHttp () {
        return this.#isHttp;
    }

    get isSocks () {
        return this.#isSocks;
    }

    get isSecure () {
        return this.#isSecure;
    }

    // upstream
    async getRemoteAddress () {
        if ( this.remoteAddress ) return this.remoteAddress;

        if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

        var address;

        try {
            const res = await fetch( "http://httpbin.org/ip", { "agent": { "proxy": this } } );

            if ( !res.ok ) throw Error();

            const json = await res.json();

            address = new IpAddress( json.origin );

            // this.remoteAddress = address;
        }
        catch ( e ) {}

        this.#mutex.unlock( address );

        return address;
    }

    getPlaywrightProxy () {

        // impossible to connect to local proxy from playwright
        if ( this.isLocal ) return;

        // http
        if ( this.isHttp ) {
            return {
                "server": ( this.isSecure ? "https://" : "http://" ) + this.hostname + ":" + this.port,
                "username": this.username,
                "password": this.password,
            };
        }

        // socks
        else {

            // playwright not support secure socks5 connections
            if ( this.isSecure ) return;

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

    // connect
    async connect ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        var hostname = url.hostname,
            resolve = this.resolve && !net.isIP( hostname );

        const port = url.port || net.getDefaultPort( url.protocol );

        if ( resolve ) {
            hostname = await resolve4( hostname );

            if ( !hostname ) return Promise.reject( "Unable to resolve hostname" );
        }

        // local proxy
        if ( this.isLocal ) {
            return this.#connectLocal( hostname, port );
        }

        // http connect
        else if ( this.isHttp ) {
            return this.#connectHttp( hostname, port );
        }

        // socks5 proxy
        else {
            return this.#connectSocks5( hostname, port );
        }
    }

    // private
    async #connectHttp ( hostname, port ) {
        var req, credentials;

        while ( 1 ) {
            if ( this.isSecure ) {
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

            if ( credentials ) req.setHeader( "Proxy-Authorization", "Basic " + credentials );

            const res = await new Promise( ( resolve, reject ) => {
                req.once( "error", reject );

                req.once( "connect", resolve );

                req.end();
            } );

            if ( res.statusCode === 200 ) {
                res.socket.proxyConnectionType = "https";

                return res.socket;
            }
            else if ( res.statusCode === 407 ) {
                if ( credentials || !this.basicAuth ) {
                    throw res.statusMessage;
                }
                else {
                    credentials = this.basicAuth;
                }
            }
            else {
                throw res.statusMessage;
            }
        }
    }

    async #connectSocks5 ( hostname, port ) {
        const socket = await new Promise( ( resolve, reject ) => {
            if ( this.isSecure ) {
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

                socket.once( "ready", () => resolve( socket ) );
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
        socket.proxyConnectionType = "socks5";

        socket.removeAllListeners();

        return socket;
    }

    async #connectLocal ( hostname, port ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e ) );

            socket.once( "ready", () => {
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
}

ProxyClientStatic.register( "http:", ProxyClientStatic );
ProxyClientStatic.register( "https:", ProxyClientStatic );
ProxyClientStatic.register( "socks5:", ProxyClientStatic );
ProxyClientStatic.register( "socks5s:", ProxyClientStatic );
