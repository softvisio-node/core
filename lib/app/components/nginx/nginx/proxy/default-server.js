import fs from "node:fs";
import path from "node:path";
import ejs from "#lib/ejs";
import Ssl from "./ssl.js";

const httpConfigTemplate = ejs.fromFile( new URL( "../../resources/server.http-default.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../../resources/server.stream-default.nginx.conf", import.meta.url ) );

export default class NginxProxyServer {
    #nginx;
    #port;
    #type;
    #ssl;
    #proxyProtocol;
    #configPath;

    constructor ( nginx, { port, type, proxyProtocol, sslEnabled } = {} ) {
        this.#nginx = nginx;
        this.#port = port;
        this.#type = type;
        this.#proxyProtocol = proxyProtocol;

        // ssl enabled
        if ( sslEnabled ) {
            this.#ssl = new Ssl( this );
        }

        // config path
        this.#configPath = this.nginx.configsDir + "/";

        if ( this.isHttp ) {
            this.#configPath += "http-servers";
        }
        else {
            this.#configPath += "stream-servers";
        }

        this.#configPath += `/_default-${ this.#port }-${ this.type }`;
        if ( this.proxyProtocol ) this.#configPath += "-proxy_protocol";
        if ( this.ssl ) this.#configPath += "-ssl";
        this.#configPath += ".nginx.conf";
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get port () {
        return this.#port;
    }

    get type () {
        return this.#type;
    }

    get isHttp () {
        return this.#type === "http";
    }

    get isTcp () {
        return this.#type === "tcp";
    }

    get isUdp () {
        return this.#type === "udp";
    }

    get proxyProtocol () {
        return this.#proxyProtocol;
    }

    get ssl () {
        return this.#ssl;
    }

    get isDefaultServer () {
        return true;
    }

    get acmeLocation () {
        return Boolean( this.isHttp && this.port === 80 && !this.ssl && this.nginx.privateHrrpServerUpstream && this.nginx.app.acme );
    }

    // public
    async writeConfig ( { localAddress } = {} ) {

        // update ssl certificates
        if ( this.#ssl ) await this.#ssl.update();

        var config;

        if ( this.isHttp ) {
            config = httpConfigTemplate.render( {
                "nginx": this.nginx,
                "server": this,
                localAddress,
            } );
        }
        else {
            config = streamConfigTemplate.render( {
                "nginx": this.nginx,
                "server": this,
                localAddress,
            } );
        }

        // write config
        fs.mkdirSync( path.dirname( this.#configPath ), { "recursive": true } );

        fs.writeFileSync( this.#configPath, config );
    }
}
