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
    #port;
    #proxyProtocol;
    #upstreams = new Set();
    #servers = new Map();
    #httpConfigPath;
    #streamConfigPath;
    #serverNamesConfigPath;
    #isDeleted = false;

    constructor ( nginx, name, port, { proxyProtocol, servers, upstreams } = {} ) {
        this.#nginx = nginx;
        this.#port = this.#validatePort( port );
        this.#id = `${name}-${this.#port}`;
        this.#proxyProtocol = !!proxyProtocol;

        this.#httpConfigPath = this.nginx.configsDir + `/http-upstreams/${this.#id}.nginx.conf`;
        this.#streamConfigPath = this.nginx.configsDir + `/stream-upstreams/${this.#id}.nginx.conf`;
        this.#serverNamesConfigPath = this.nginx.configsDir + `/ssl-server-upstreams/${this.#id}.443.nginx.conf`;

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

    get port () {
        return this.#port;
    }

    get proxyProtocol () {
        return this.#proxyProtocol;
    }

    get upstreams () {
        return this.#upstreams;
    }

    get hasUpstreams () {
        return !!this.#upstreams.size;
    }

    // public
    async updateConfig () {

        // delete configs
        this.#deleteConfig();

        if ( this.#isDeleted ) return;

        var counter = new Counter(),
            hasHttpServers,
            hasStreamServers,
            serverNames = new Set();

        for ( const server of this.#servers.values() ) {
            if ( server.isHttp ) {
                hasHttpServers = true;
            }
            else {
                hasStreamServers = true;

                if ( server.poer === 443 ) server.serverName.forEach( serverName => serverNames.add( serverName ) );
            }

            counter.value++;

            server.updateConfig().then( () => counter.value-- );
        }

        await counter.wait();

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

            if ( serverNames.size ) {
                fs.writeFileSync( this.#serverNamesConfigPath, [...serverNames].map( serverName => `"${serverName}"    "${this.id}"\n` ).join( "" ) );
            }

            //
        }

        if ( this.#isDeleted ) return this.#deleteConfig();
    }

    async delete () {
        if ( this.#isDeleted ) return;

        this.#isDeleted = true;

        // delete servers
        for ( const server of this.#servers.values() ) {
            server.delete();
        }

        this.#deleteConfig();

        this.nginx.deleteProxy( this.#port );
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

            port ||= this.#port;

            port = this.#validatePort( port );

            if ( !port ) return;

            return `${address}:${port}`;
        }
    }

    #deleteConfig () {
        fs.rmSync( this.#httpConfigPath, { "force": true } );

        fs.rmSync( this.#streamConfigPath, { "force": true } );

        fs.rmSync( this.#serverNamesConfigPath, { "force": true } );
    }
}
