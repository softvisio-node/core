import DigitalSize from "#lib/digital-size";
import ejs from "#lib/ejs";
import Interval from "#lib/interval";
import DefaultServer from "./default-server.js";

const httpConfigTemplate = ejs.fromFile( new URL( "../../resources/server.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../../resources/server.stream.nginx.conf", import.meta.url ) );

export default class NginxProxyServer extends DefaultServer {
    #proxy;
    #maxBodySize;
    #cacheEnabled;
    #cacheBypass;
    #httpsRedirectPort;
    #hstsMaxAge;
    #hstsSubdomains;
    #isDeleted = false;

    constructor ( proxy, port, { type, proxyProtocol, ssl, maxBodySize, cacheEnabled, cacheBypass, httpsRedirectPort, hstsMaxAge, hstsSubdomains } = {} ) {
        super( proxy.nginx, port, { type, proxyProtocol, ssl } );

        this.#proxy = proxy;

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
    }

    // properties
    get proxy () {
        return this.#proxy;
    }

    get serverNames () {
        return this.#proxy.serverNames;
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
    async generateConfig ( { serverName, localAddress } = {} ) {

        // update ssl certificates
        if ( this.ssl ) {
            await serverName.updateCertificate();
        }

        var config;

        if ( this.isHttp ) {
            config = httpConfigTemplate.render( {
                "nginx": this.nginx,
                "server": this,
                serverName,
                localAddress,
            } );
        }
        else {
            config = streamConfigTemplate.render( {
                "nginx": this.nginx,
                "server": this,
                serverName,
                localAddress,
            } );
        }

        return config;
    }

    delete () {
        if ( this.#isDeleted ) return;

        this.#isDeleted = true;

        this.#proxy.servers.delete( this.port );

        return this;
    }
}
