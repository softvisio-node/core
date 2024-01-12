import ejs from "#lib/ejs";
import Ssl from "./ssl.js";
import DigitalSize from "#lib/digital-size";
import fs from "node:fs";
import path from "node:path";

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

    constructor ( proxy, { port, type, serverName, sslEnabled, maxBodySize, cacheEnabled, cacheBypass, proxyProtocol } = {} ) {
        this.#proxy = proxy;
        this.#port = port;

        // type
        if ( this.#port === 80 ) {
            this.#type = type || "http";
            sslEnabled = sslEnabled == null ? false : !!sslEnabled;
        }
        else if ( this.#port === 443 ) {
            this.#type = type || "http";
            sslEnabled = sslEnabled == null ? true : !!sslEnabled;
        }
        else {
            this.#type = type || "tcp";

            if ( this.isUdp ) {
                sslEnabled = false;
            }
            else {
                sslEnabled = !!sslEnabled;
            }
        }

        this.#proxyProtocol = !!proxyProtocol;

        // ssl enabled
        if ( sslEnabled ) {
            this.#ssl = new Ssl( this );
        }

        // names
        if ( this.isHttp || this.ssl ) {
            if ( !Array.isArray( serverName ) ) serverName = [serverName];

            this.#serverName = [...new Set( serverName )]
                .map( serverName => serverName?.trim() )
                .filter( serverName => serverName )
                .sort();
        }
        else {
            this.#serverName = [];
        }

        // http opttions
        if ( this.isHttp ) {
            this.#maxBodySize = maxBodySize || this.nginx.config.maxBodySize;

            // cache enabled
            if ( !this.nginx.config.cacheEnabled ) {
                this.#cacheEnabled = false;
            }
            else {
                this.#cacheEnabled = !!( cacheEnabled ?? true );
            }

            this.#cacheBypass = !!( cacheBypass ?? this.nginx.config.cacheBypass );
        }

        // config path
        this.#configPath = this.nginx.configsDir + "/";

        if ( this.isHttp ) {
            this.#configPath += "http-servers";
        }
        else {
            this.#configPath += "stream-servers";
        }

        this.#configPath += `/${this.#proxy.id}-${this.#port}`;
        if ( this.ssl ) this.#configPath += "-ssl";
        this.#configPath += ".nginx.conf";

        // socket path
        if ( this.isHttp ) {
            this.#socketPath = this.nginx.getSocketPath( "http", this.port, !!this.ssl );
        }
        else {
            this.#socketPath = this.nginx.getSocketPath( this.proxy.id, this.port, !!this.ssl );
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

    get isDefaultServer () {
        return !this.#serverName.length;
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
    async writeConfig ( { useRouter } = {} ) {

        // update ssl certificates
        if ( this.#ssl ) await this.#ssl.update();

        var config;

        if ( this.isHttp ) {
            config = httpConfigTemplate.render( {
                "nginx": this.nginx,
                "server": this,
                useRouter,
            } );
        }
        else {
            config = streamConfigTemplate.render( {
                "nginx": this.nginx,
                "server": this,
                useRouter,
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

        this.#proxy.deleteServer( this );
    }
}
