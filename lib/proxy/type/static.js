import "#lib/stream";

import mixins from "#lib/mixins";
import ProxyClient from "#lib/proxy/client";
import net from "net";
import http from "http";
import IpAddr from "#lib/ip/addr";
import fetch from "#lib/fetch";
import Mutex from "#lib/threads/mutex";
import { resolve4 } from "#lib/dns";
import { getDefaultPort } from "#lib/utils/net";

import OptionsCountry from "../mixins/country.js";
import OptionsRemoteAddr from "../mixins/remote-addr.js";
import OptionsLocalAddr from "../mixins/local-addr.js";

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

export default class ProxyClientStatic extends mixins( OptionsCountry, OptionsRemoteAddr, OptionsLocalAddr, ProxyClient ) {
    #isHttp = false;
    #isSocks = false;

    #mutex = new Mutex();

    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super._init ) super._init( url, options );

        if ( this.protocol.includes( "http" ) ) this.#isHttp = true;

        if ( this.protocol.includes( "socks" ) ) this.#isSocks = true;
    }

    // props
    get isHttp () {
        return this.#isHttp;
    }

    get isSocks () {
        return this.#isSocks;
    }

    // upstream
    async getRemoteAddr () {
        if ( this.remoteAddr ) return this.remoteAddr;

        if ( !this.#mutex.tryDown() ) return await this.#mutex.signal.wait();

        var addr;

        try {
            const res = await fetch( "http://httpbin.org/ip", { "agent": { "proxy": this } } );

            if ( !res.ok ) throw Error();

            const json = await res.json();

            addr = new IpAddr( json.origin );

            // this.remoteAddr = addr;
        }
        catch ( e ) {}

        this.#mutex.up();

        this.#mutex.signal.broadcast( addr );

        return addr;
    }

    getPlaywrightProxy () {

        // impossible to connect to local proxy from playwright
        if ( this.isLocal ) return;

        // http
        if ( this.isHttp ) {
            return {
                "server": "http://" + this.hostname + ":" + this.port,
                "username": this.username,
                "password": this.password,
            };
        }

        // socks
        else {
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
    async connect ( url, options = {}, updateHttpRequest ) {
        if ( typeof url === "string" ) url = new URL( url );

        const requireSocks = url.protocol !== "https:" && url.protocol !== "http:";

        if ( requireSocks && !this.isSocks ) return Promise.reject( "Socks proxy is required" );

        var hostname = url.hostname,
            resolve = this.resolve && !net.isIP( hostname );

        const port = url.port || getDefaultPort( url.protocol );

        if ( resolve ) {
            hostname = await resolve4( hostname );

            if ( !hostname ) return Promise.reject( "Unable to resolve hostname" );
        }

        if ( this.isLocal ) {
            return this.#connectLocal( hostname, port );
        }
        else if ( requireSocks || !this.isHttp ) {
            if ( updateHttpRequest ) updateHttpRequest( { "hostname": resolve ? hostname : null } );

            return this.#connectSocks5( hostname, port );
        }
        else {

            // http
            if ( url.protocol === "http:" ) {
                if ( updateHttpRequest ) {
                    updateHttpRequest( {
                        "http": true,
                        "hostname": resolve ? hostname : null,
                        "auth": this.basicAuth,
                    } );
                }

                return this.#connectHttp( hostname, port );
            }

            // https
            else {
                if ( updateHttpRequest ) updateHttpRequest( { "hostname": resolve ? hostname : null } );

                return this.#connectHttps( hostname, port );
            }
        }
    }

    // private
    async #connectHttp ( hostname, port ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.proxyConnectionType = "http";

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e.message ) );

            socket.once( "ready", () => {
                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( this.port, this.hostname );
        } );
    }

    async #connectHttps ( hostname, port ) {
        return new Promise( ( resolve, reject ) => {
            const req = http.request( {
                "method": "CONNECT",
                "host": this.hostname,
                "port": this.port,
                "path": hostname + ":" + port,
            } );

            req.setHeader( "Host", hostname + ":" + port );

            if ( this.basicAuth ) req.setHeader( "Proxy-Authorization", "Basic " + this.basicAuth );

            req.once( "error", e => reject( e.message ) );

            req.once( "connect", res => {
                if ( res.statusCode === 200 ) {
                    res.socket.proxyConnectionType = "https";

                    resolve( res.socket );
                }
                else {
                    reject( res.statusMessage );
                }
            } );

            req.end();
        } );
    }

    async #connectSocks5 ( hostname, port ) {
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
                    ip = new IpAddr( hostname );
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
                    buf.writeUInt32BE( ip.value );

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
                socket.proxyConnectionType = "socks5";

                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( this.port, this.hostname );
        } );
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
                "family": this.localAddr.isV4 ? 4 : 6,
            } );
        } );
    }
}

ProxyClientStatic.register( "http:", ProxyClientStatic );
ProxyClientStatic.register( "socks:", ProxyClientStatic );
ProxyClientStatic.register( "socks5:", ProxyClientStatic );
ProxyClientStatic.register( "http+socks:", ProxyClientStatic );
ProxyClientStatic.register( "http+socks5:", ProxyClientStatic );
ProxyClientStatic.register( "socks+http:", ProxyClientStatic );
ProxyClientStatic.register( "socks5+http:", ProxyClientStatic );
