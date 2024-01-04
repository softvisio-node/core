import NginxProxyServer from "./proxy/server.js";
import ejs from "#lib/ejs";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";
import Counter from "#lib/threads/counter";

const httpConfigTemplate = ejs.fromFile( new URL( "../resources/upstream.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../resources/upstream.stream.nginx.conf", import.meta.url ) );

export default class NginxProxy {
    #nginx;
    #id;
    #upstreamPort;
    #upstreamProxyProtocol;
    #upstreams = new Set();
    #servers = new Map();
    #httpConfigPath;
    #streamConfigPath;
    #isDeleted = false;

    constructor ( nginx, name, upstreamPort, { upstreamProxyProtocol, servers, upstreams } = {} ) {
        this.#nginx = nginx;
        this.#upstreamPort = this.#validatePort( upstreamPort );
        this.#id = `${name}-${this.#upstreamPort}`;
        this.#upstreamProxyProtocol = !!upstreamProxyProtocol;

        this.#httpConfigPath = this.nginx.configsDir + `/http-upstreams/${this.#id}.nginx.conf`;
        this.#streamConfigPath = this.nginx.configsDir + `/stream-upstreams/${this.#id}.nginx.conf`;

        // add servers
        if ( servers ) {
            for ( const [port, options] of Object.entries( servers ) ) {
                this.#addServer( port, options );
            }
        }

        // add upstreams
        if ( upstreams ) {
            this.#addUpstreams( upstreams );
        }
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get id () {
        return this.#id;
    }

    get upstreamPort () {
        return this.#upstreamPort;
    }

    get upstreamProxyProtocol () {
        return this.#upstreamProxyProtocol;
    }

    get upstreams () {
        return this.#upstreams;
    }

    get hasUpstreams () {
        return !!this.#upstreams.size;
    }

    get servers () {
        return this.#servers;
    }

    // public
    async updateConfig ( ports ) {
        if ( this.#isDeleted ) return;

        var counter = new Counter(),
            hasHttpServers,
            hasStreamServers;

        for ( const server of this.#servers.values() ) {
            if ( server.isHttp ) {
                hasHttpServers = true;
            }
            else {
                hasStreamServers = true;
            }

            counter.value++;

            server.updateConfig( ports ).then( () => counter.value-- );
        }

        await counter.wait();

        if ( !this.hasUpstreams ) return;

        if ( hasHttpServers ) {
            const config = httpConfigTemplate.render( {
                "proxy": this,
            } );

            // write config
            fs.mkdirSync( path.dirname( this.#httpConfigPath ), { "recursive": true } );
            fs.writeFileSync( this.#httpConfigPath, config );
        }

        if ( hasStreamServers ) {
            const config = streamConfigTemplate.render( {
                "proxy": this,
            } );

            // write config
            fs.mkdirSync( path.dirname( this.#streamConfigPath ), { "recursive": true } );
            fs.writeFileSync( this.#streamConfigPath, config );

            //
        }
    }

    delete () {
        if ( this.#isDeleted ) return;

        this.#isDeleted = true;

        // delete servers
        for ( const server of this.#servers.values() ) {
            server.delete();
        }

        this.nginx.deleteProxy( this.#upstreamPort );
    }

    addServer ( port, options ) {
        const updated = this.#addServer( port, options );

        if ( updated ) this.nginx.reload();
    }

    deleteServer ( port ) {
        const updated = this.#deleteServer( port );

        if ( updated ) this.nginx.reload();
    }

    addUpstreams ( upstreams ) {
        const updated = this.#addUpstreams( upstreams );

        if ( updated ) this.nginx.reload();
    }

    deleteUpstreams ( upstreams ) {
        const updated = this.#deleteUpstreams( upstreams );

        if ( updated ) this.nginx.reload();
    }

    // private
    #addServer ( port, options ) {
        port = this.#validatePort( port );

        if ( !port ) return false;

        if ( this.#servers.has( port ) ) return false;

        const server = new NginxProxyServer( this, port, options );

        this.#servers.set( port, server );

        return true;
    }

    #deleteServer ( port ) {
        port = this.#validatePort( port );

        if ( !port ) return false;

        const server = this.#servers.get( port );

        if ( !server ) return false;

        this.#servers.delete( port );

        server.delete();

        return true;
    }

    #addUpstreams ( upstreams ) {
        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        var updated = false;

        for ( let upstream of upstreams ) {
            upstream = this.#validateUpstreamServer( upstream );

            if ( !upstream ) continue;

            if ( this.#upstreams.has( upstream ) ) continue;

            this.#upstreams.add( upstream );

            updated = true;
        }

        return updated;
    }

    #deleteUpstreams ( upstreams ) {
        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        var updated = false;

        for ( let upstream of upstreams ) {
            upstream = this.#validateUpstreamServer( upstream );

            if ( !upstream ) continue;

            if ( !this.#upstreams.has( upstream ) ) continue;

            this.#upstreams.delete( upstream );

            updated = true;
        }

        return updated;
    }

    #validatePort ( port ) {
        if ( !port ) return;

        port = Number( port );

        if ( port < 1 || port > 65535 ) return;

        return port;
    }

    #validateUpstreamServer ( server ) {
        if ( !server ) return;

        // unix socket
        if ( server.startsWith( "unix:" ) ) {
            return server;
        }

        // ip address
        else {
            var [address, port] = server.split( ":" );

            const ip = net.isIP( address );

            if ( !ip ) return;

            port ||= this.#upstreamPort;

            port = this.#validatePort( port );

            if ( !port ) return;

            return `${address}:${port}`;
        }
    }
}
