import fs from "node:fs";
import path from "node:path";
import DigitalSize from "#lib/digital-size";
import ejs from "#lib/ejs";
import DefaultServer from "./default-server.js";

const httpConfigTemplate = ejs.fromFile( new URL( "../../resources/server.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../../resources/server.stream.nginx.conf", import.meta.url ) );

export default class NginxProxyServer extends DefaultServer {
    #proxy;
    #serverName;
    #maxBodySize;
    #cacheEnabled;
    #cacheBypass;
    #configPath;
    #isDeleted = false;

    constructor ( proxy, { port, type, proxyProtocol, sslEnabled, serverName, maxBodySize, cacheEnabled, cacheBypass } = {} ) {
        super( proxy.nginx, { port, type, proxyProtocol, sslEnabled } );

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
        return DigitalSize.new( this.#maxBodySize ).toNginx();
    }

    get cacheEnabled () {
        return this.#cacheEnabled;
    }

    get cacheBypass () {
        return this.#cacheBypass;
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
