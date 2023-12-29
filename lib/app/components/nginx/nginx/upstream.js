import NginxUpstreamServer from "./upstream/server.js";
import ejs from "#lib/ejs";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";

const httpConfigTemplate = ejs.fromFile( new URL( "../resources/upstream.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../resources/upstream.stream.nginx.conf", import.meta.url ) );

export default class NginxUpstream {
    #nginx;
    #id;
    #port;
    #proxyProtocol;
    #upstreams = new Set();
    #servers = new Map();
    #httpConfigPath;
    #streamConfigPath;
    #isDeleted = false;

    constructor ( nginx, name, port, { proxyProtocol } = {} ) {
        this.#nginx = nginx;
        this.#port = this.#validatePort( port );
        this.#id = `${name}-${this.#port}`;
        this.#proxyProtocol = !!proxyProtocol;

        this.#httpConfigPath = this.nginx.configsDir + `/http-upstreams/${this.#id}.nginx.conf`;
        this.#streamConfigPath = this.nginx.configsDir + `/stream-upstreams/${this.#id}.nginx.conf`;
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
    // XXX
    async updateConfig () {

        // delete configs
        this.#deleteConfig();

        if ( this.#isDeleted ) return;

        for ( const server of this.#servers.values() ) {
            if ( !server.isHttp ) continue;

            await server.updateConfig();

            const config = httpConfigTemplate.render( {
                "upstream": this,
            } );

            // write config
            fs.mkdirSync( path.dirname( this.#httpConfigPath ), { "recursive": true } );
            fs.writeFileSync( this.#httpConfigPath, config );

            break;
        }

        for ( const server of this.#servers.values() ) {
            if ( server.isHttp ) continue;

            await server.updateConfig();

            const config = streamConfigTemplate.render( {
                "upstream": this,
            } );

            // write config
            fs.mkdirSync( path.dirname( this.#streamConfigPath ), { "recursive": true } );
            fs.writeFileSync( this.#streamConfigPath, config );

            break;
        }

        if ( this.#isDeleted ) return this.#deleteConfig();

        // updste 443 stream server names
        for ( const server of this.#servers.values() ) {
            if ( server.isHttp ) continue;
            if ( server.poer !== 443 ) continue;

            // XXX append
            // this.nginx.sslServerUpstreamsConfigPath
        }
    }

    async delete () {
        if ( this.#isDeleted ) return;

        this.#isDeleted = true;

        // delete servers
        for ( const server of this.#servers.values() ) {
            server.delete();
        }

        this.#deleteConfig();

        this.nginx.deleteUpstream( this.#port );
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
        port = this.#validatePort();

        if ( !port ) return false;

        if ( this.#servers.has( port ) ) return false;

        const server = new NginxUpstreamServer( this, port, options );

        this.#servers.set( port, server );

        return true;
    }

    #deleteServer ( port ) {
        port = this.#validatePort();

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
    }
}
