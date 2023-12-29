import ejs from "#lib/ejs";
import Ssl from "./ssl.js";
import DigitalSize from "#lib/digital-size";
import fs from "node:fs";
import path from "node:path";

const httpConfigTemplate = ejs.fromFile( new URL( "../../resources/server.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../../resources/server.stream.nginx.conf", import.meta.url ) );

export default class NginxUpstreamServer {
    #upstream;
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

    constructor ( upstream, port, { type, serverName, sslEnabled, maxBodySize, cacheEnabled, cacheBypass, proxyProtocol } = {} ) {
        this.#upstream = upstream;
        this.#port = port;

        // type
        if ( this.#port === 80 ) {
            this.#type = "http";
        }
        else if ( this.#port === 443 ) {
            this.#type = type || "http";
        }
        else {
            this.#type = type || "tcp";
        }

        // names
        if ( !Array.isArray( serverName ) ) serverName = [serverName];
        this.#serverName = [...new Set( serverName )].filter( serverName => serverName ).sort();

        // ssl enabled
        if ( this.#port === 80 ) {
            sslEnabled = false;
        }
        else if ( this.#port === 443 ) {
            sslEnabled = true;
        }
        else if ( this.isUdp ) {
            sslEnabled = false;
        }
        else {
            sslEnabled = !!sslEnabled;
        }

        if ( sslEnabled ) {
            this.#ssl = new Ssl( this.nginx, this.#serverName );
        }

        this.#maxBodySize = maxBodySize || this.nginx.config.maxBodySize;

        // cache enabled
        if ( !this.nginx.config.cacheEnabled ) {
            this.#cacheEnabled = false;
        }
        else {
            this.#cacheEnabled = !!( cacheEnabled ?? true );
        }

        this.#cacheBypass = !!( cacheBypass ?? this.nginx.config.cacheBypass );

        this.#proxyProtocol = !!proxyProtocol;

        // config path
        if ( this.isHttp ) {
            if ( this.#serverName.length ) {
                this.#configPath = this.nginx.configsDir + `/http/${this.#upstream.id}-${this.#port}.nginx.conf`;
            }
            else {
                this.#configPath = this.nginx.configsDir + `/http-default/${this.#upstream.id}-${this.#port}.nginx.conf`;
            }
        }
        else {
            this.#configPath = this.nginx.configsDir + `/streams/${this.#upstream.id}-${this.#port}.nginx.conf`;
        }
    }

    // properties
    get upstream () {
        return this.#upstream;
    }

    get nginx () {
        return this.#upstream.nginx;
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

    // public
    // XXX
    async updateConfig () {

        // delete configs
        this.#deleteConfig();

        if ( this.#isDeleted ) return;

        if ( this.#ssl ) {
            await this.#ssl.update();
        }

        var config;

        if ( this.isHttp ) {
            config = httpConfigTemplate.render( {
                "server": this,
                "upstream": this.#upstream,
                "listenIpFamily": this.nginx.config.listenIpFamily,
                "unixSocketsPath": this.nginx.unixSocketsPath,

                // private hrrp serve
                "privateHrrpServerUpstream": this.nginx.privateHrrpServerUpstream,
                "acmeChallengesUrl": this.nginx.acmeChallengesUrl,

                // XXX
                "redirectToHttps": !this.#ssl && true,
            } );
        }
        else {
            config = streamConfigTemplate.render( {
                "server": this,
                "upstream": this.#upstream,
                "listenIpFamily": this.nginx.config.listenIpFamily,
                "unixSocketsPath": this.nginx.unixSocketsPath,
            } );
        }

        // write config
        fs.mkdirSync( path.dirname( this.#configPath ), { "recursive": true } );

        fs.writeFileSync( this.#configPath, config );

        if ( this.#isDeleted ) return this.#deleteConfig();
    }

    delete () {
        if ( this.#isDeleted ) return;

        this.#isDeleted = true;

        this.#ssl?.clear();

        this.#deleteConfig();

        this.#upstream.deleteServer( this.#port );
    }

    // private
    #deleteConfig () {
        fs.rmSync( this.#configPath, { "force": true } );
    }
}
