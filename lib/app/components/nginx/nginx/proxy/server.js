import ejs from "#lib/ejs";
import Ssl from "./ssl.js";
import DigitalSize from "#lib/digital-size";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const httpConfigTemplate = ejs.fromFile( new URL( "../../resources/server.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../../resources/server.stream.nginx.conf", import.meta.url ) );

export default class NginxProxyServer {
    #proxy;
    #type;
    #port;
    #serverName;
    #maxBodySize;
    #cacheEnabled;
    #cacheBypass;
    #proxyProtocol;
    #ssl;
    #configPath;
    #isDeleted = false;
    #socketPath;

    // XXX
    constructor ( proxy, port, { type, serverName, sslEnabled, maxBodySize, cacheEnabled, cacheBypass, proxyProtocol } = {} ) {
        this.#proxy = proxy;
        this.#port = port;

        // type
        if ( this.#port === 80 ) {
            this.#type = "http";
            sslEnabled = false;
            proxyProtocol = false;
        }
        else if ( this.#port === 443 ) {
            this.#type = type || "http";
            sslEnabled = true;
            proxyProtocol = true;
        }
        else {
            this.#type = type || "tcp";

            if ( this.isUdp ) {
                sslEnabled = false;
            }
            else {
                sslEnabled = !!sslEnabled;
            }

            proxyProtocol = !!proxyProtocol;
        }

        // names
        if ( !Array.isArray( serverName ) ) serverName = [serverName];
        this.#serverName = [...new Set( serverName )]
            .map( serverName => serverName?.trim() )
            .filter( serverName => serverName )
            .sort();

        // ssl enabled
        if ( sslEnabled ) {
            this.#ssl = new Ssl( this );
        }

        this.#proxyProtocol = proxyProtocol;

        this.#maxBodySize = maxBodySize || this.nginx.config.maxBodySize;

        // cache enabled
        if ( !this.nginx.config.cacheEnabled ) {
            this.#cacheEnabled = false;
        }
        else {
            this.#cacheEnabled = !!( cacheEnabled ?? true );
        }

        this.#cacheBypass = !!( cacheBypass ?? this.nginx.config.cacheBypass );

        // config path
        if ( this.isHttp ) {
            if ( this.#serverName.length ) {
                this.#configPath = this.nginx.configsDir + `/http-servers/${this.#proxy.id}-${this.#port}.nginx.conf`;
            }
            else {
                this.#configPath = this.nginx.configsDir + `/http-servers-default/${this.#proxy.id}-${this.#port}.nginx.conf`;
            }
        }
        else {
            this.#configPath = this.nginx.configsDir + `/stream-servers/${this.#proxy.id}-${this.#port}.nginx.conf`;
        }

        if ( this.isHttp ) {
            this.#socketPath = this.nginx.getHttpsSocketPath( this.port );
        }
        else {
            this.#socketPath = `${this.nginx.unixSocketsDir}/${this.proxy.id}.${this.port}.socket`;

            // XXX https://forum.nginx.org/read.php?21,298674
            // XXX delete after bug will be closed
            this.#socketPath = "/var/run/" + crypto.createHash( "md5" ).update( this.#socketPath ).digest( "base64url" ) + ".socket";
        }
    }

    // properties
    get proxy () {
        return this.#proxy;
    }

    get nginx () {
        return this.#proxy.nginx;
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

    get port () {
        return this.#port;
    }

    get serverName () {
        return this.#serverName;
    }

    get ssl () {
        return this.#ssl;
    }

    get maxBodySize () {
        return DigitalSize.new( this.#maxBodySize ).toNginx();
    }

    get cacheEnabled () {
        return this.#cacheEnabled;
    }

    get cacheBypass () {
        return this.#cacheBypass;
    }

    get proxyProtocol () {
        return this.#proxyProtocol;
    }

    get socketPath () {
        return this.#socketPath;
    }

    // public
    async writeConfig ( { listenSocket } = {} ) {

        // update ssl certificates
        if ( this.#ssl ) await this.#ssl.update();

        var config;

        if ( this.isHttp ) {
            config = httpConfigTemplate.render( {
                "server": this,
                listenSocket,
                "listenIpFamily": this.nginx.config.listenIpFamily,

                // private hrrp serve
                "privateHrrpServerUpstream": this.nginx.privateHrrpServerUpstream,
                "acmeChallengesUrl": this.nginx.acmeChallengesUrl,
            } );
        }
        else {
            config = streamConfigTemplate.render( {
                "server": this,
                listenSocket,
                "listenIpFamily": this.nginx.config.listenIpFamily,
            } );
        }

        // write config
        fs.mkdirSync( path.dirname( this.#configPath ), { "recursive": true } );

        fs.writeFileSync( this.#configPath, config );
    }

    delete () {
        if ( this.#isDeleted ) return;

        this.#isDeleted = true;

        this.#ssl?.clear();

        this.#proxy.deleteServer( this.#port );
    }
}
