import fs from "node:fs";
import path from "node:path";
import DigitalSize from "#lib/digital-size";
import ejs from "#lib/ejs";
import Interval from "#lib/interval";
import DefaultServer from "./default-server.js";

const httpConfigTemplate = ejs.fromFile( new URL( "../../resources/server.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../../resources/server.stream.nginx.conf", import.meta.url ) );

export default class NginxProxyServer extends DefaultServer {
    #proxy;
    #serverName;
    #maxBodySize;
    #cacheEnabled;
    #cacheBypass;
    #httpsRedirectPort;
    #hstsMaxAge;
    #hstsSubdomains;
    #configPath;
    #isDeleted = false;

    constructor ( proxy, { port, type, proxyProtocol, ssl, serverName, maxBodySize, cacheEnabled, cacheBypass, httpsRedirectPort, hstsMaxAge, hstsSubdomains } = {} ) {
        super( proxy.nginx, { port, type, proxyProtocol, ssl } );

        this.#proxy = proxy;

        // names
        if ( this.isHttp || this.ssl ) {
            if ( !Array.isArray( serverName ) ) serverName = [ serverName ];

            this.#serverName = [ ...new Set( serverName ) ]
                .map( serverName => serverName?.trim() )
                .filter( serverName => serverName )
                .sort();

            if ( !this.#serverName.length ) this.#serverName = null;
        }
        else {
            this.#serverName = null;
        }

        // http opttions
        if ( this.isHttp ) {
            if ( maxBodySize ) {
                try {
                    this.#maxBodySize = DigitalSize.new( maxBodySize ).toNginx();
                }
                catch {}
            }

            this.#maxBodySize ||= DigitalSize.new( this.nginx.config.maxBodySize ).toNginx();

            // cache enabled
            if ( !this.nginx.config.cacheEnabled ) {
                this.#cacheEnabled = false;
            }
            else {
                this.#cacheEnabled = Boolean( cacheEnabled ?? true );
            }

            this.#cacheBypass = Boolean( cacheBypass ?? this.nginx.config.cacheBypass );

            if ( this.ssl ) {
                if ( hstsMaxAge ) {
                    this.#hstsMaxAge = new Interval( hstsMaxAge ).toSeconds();
                    this.#hstsSubdomains = !!hstsSubdomains;
                }
            }
            else {
                this.#httpsRedirectPort = httpsRedirectPort;
            }
        }

        // config path
        this.#configPath = this.nginx.configsDir + "/";

        if ( this.isHttp ) {
            this.#configPath += "http-servers";
        }
        else {
            this.#configPath += "stream-servers";
        }

        this.#configPath += `/${ this.#proxy.id }-${ this.port }-${ this.type }`;
        if ( this.proxyProtocol ) this.#configPath += "-proxy_protocol";
        if ( this.ssl ) this.#configPath += "-ssl";
        this.#configPath += ".nginx.conf";
    }

    // properties
    get proxy () {
        return this.#proxy;
    }

    get serverName () {
        return this.#serverName;
    }

    get isDefaultServer () {
        return !this.#serverName;
    }

    get maxBodySize () {
        return this.#maxBodySize;
    }

    get cacheEnabled () {
        return this.#cacheEnabled;
    }

    get cacheBypass () {
        return this.#cacheBypass;
    }

    get httpsRedirectPort () {
        return this.#httpsRedirectPort;
    }

    get hstsMaxAge () {
        return this.#hstsMaxAge;
    }

    get hstsSubdomains () {
        return this.#hstsSubdomains;
    }

    get httpsRedirectUrl () {
        if ( !this.httpsRedirectPort ) {
            return null;
        }
        else if ( this.httpsRedirectPort === 443 ) {
            return `https://$host$request_uri`;
        }
        else {
            return `https://$host:${ this.httpsRedirectPort }$request_uri`;
        }
    }

    // public
    async writeConfig ( { localAddress } = {} ) {

        // update ssl certificates
        if ( this.ssl ) await this.ssl.update();

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

    delete () {
        if ( this.#isDeleted ) return;

        this.#isDeleted = true;

        this.ssl?.destroy();

        this.#proxy.deleteServer( this );
    }
}
