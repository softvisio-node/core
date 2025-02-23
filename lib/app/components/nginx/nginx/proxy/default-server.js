import ejs from "#lib/ejs";
import NginxServerNames from "./server-names.js";

const httpConfigTemplate = ejs.fromFile( new URL( "../../resources/server.http-default.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../../resources/server.stream-default.nginx.conf", import.meta.url ) );

export default class NginxProxyDefaultServer {
    #nginx;
    #port;
    #type;
    #proxyProtocol;
    #ssl;
    #serverNames;
    #configPath;

    constructor ( nginx, { port, type, proxyProtocol, ssl } = {} ) {
        this.#nginx = nginx;
        this.#port = port;

        // type
        if ( this.#port === 80 ) {
            this.#type = type || "http";
            ssl ??= false;
        }
        else if ( this.#port === 443 ) {
            this.#type = type || "http";
            ssl ??= true;
        }
        else {
            this.#type = type || "tcp";
        }

        if ( this.isUdp ) {
            ssl = false;
            proxyProtocol = false;
        }
        else {
            ssl = !!ssl;
        }

        this.#proxyProtocol = !!proxyProtocol;

        this.#ssl = ssl;

        this.#serverNames = new NginxServerNames( this.#nginx );
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get configPath () {
        if ( !this.#configPath ) {

            // config path
            this.#configPath = this.nginx.configsDir + "/";

            if ( this.isHttp ) {
                this.#configPath += "http-servers";
            }
            else {
                this.#configPath += "stream-servers";
            }

            this.#configPath += `/${ this.#port }-`;

            if ( this.ssl ) this.#configPath += "ssl-";

            if ( this.proxy ) {
                this.#configPath += this.proxy.id;
            }
            else {
                this.#configPath += "_default";
            }

            this.#configPath += ".nginx.conf";
        }

        return this.#configPath;
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

    get serverNames () {
        return this.#serverNames;
    }

    get isDefaultServer () {
        if ( this.isHttp || this.ssl ) {
            return !this.serverNames.hasServerNames;
        }
        else {
            return true;
        }
    }

    get acmeLocation () {
        return Boolean( this.isHttp && this.port === 80 && !this.ssl && this.nginx.privateHrrpServerUpstream && this.nginx.app.acme?.httpEnabled );
    }

    // public
    async generateConfig ( { localAddress } = {} ) {
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

        return config;
    }
}
