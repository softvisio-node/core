import fs from "node:fs";
import path from "node:path";
import ejs from "#lib/ejs";
import NginxProxyServerNames from "./proxy/server-names.js";
import NginxProxyServers from "./proxy/servers.js";
import NginxProxyUpstreams from "./proxy/upstreams.js";

const httpConfigTemplate = ejs.fromFile( new URL( "../resources/upstream.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../resources/upstream.stream.nginx.conf", import.meta.url ) );

export default class NginxProxy {
    #nginx;
    #id;
    #name;
    #upstreamPort;
    #upstreamProxyProtocol;
    #serverNames;
    #servers;
    #upstreams;
    #httpConfigPath;
    #streamConfigPath;
    #isDeleted = false;

    constructor ( nginx, name, upstreamPort, { upstreamProxyProtocol, serverNames, servers, upstreams } = {} ) {
        this.#nginx = nginx;
        this.#name = name;
        this.#upstreamPort = this.#nginx.validatePort( upstreamPort );
        this.#id = `${ name }-${ this.#upstreamPort }`;
        this.#upstreamProxyProtocol = !!upstreamProxyProtocol;

        this.#httpConfigPath = this.nginx.configsDir + `/http-upstreams/${ this.#id }.nginx.conf`;
        this.#streamConfigPath = this.nginx.configsDir + `/stream-upstreams/${ this.#id }.nginx.conf`;

        // add server names
        this.#serverNames = new NginxProxyServerNames( this.#nginx, serverNames );

        // add servers
        this.#servers = new NginxProxyServers( this, servers );

        // add upstreams
        this.#upstreams = new NginxProxyUpstreams( this, upstreams );
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get id () {
        return this.#id;
    }

    get name () {
        return this.#name;
    }

    get upstreamPort () {
        return this.#upstreamPort;
    }

    get upstreamProxyProtocol () {
        return this.#upstreamProxyProtocol;
    }

    get serverNames () {
        return this.#serverNames;
    }

    get servers () {
        return this.#servers;
    }

    get upstreams () {
        return this.#upstreams;
    }

    // public
    delete () {
        if ( this.#isDeleted ) return;

        this.#isDeleted = true;

        // delete servers
        for ( const server of this.#servers ) {
            server.delete();
        }

        this.nginx.proxies.delete( this.#name, this.#upstreamPort );
    }

    writeConfig ( { hasHttpServers, hasStreamServers } = {} ) {
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
}
