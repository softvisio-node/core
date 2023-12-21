import fs from "node:fs";
import ejs from "#lib/ejs";
import DigitalSize from "#lib/digital-size";
import Interval from "#lib/interval";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

const httpConfigTemplate = ejs.fromFile( new URL( "../resources/server.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../resources/server.stream.nginx.conf", import.meta.url ) );

export default class NginxServer {
    #nginx;
    #id;

    #httpPort;
    #upstreams;
    #serverNames;
    #upstreamHttpPort;
    #streamPorts;
    #maxBodySize;
    #cacheEnabled;
    #cacheBypass;

    #httpConfigPath;
    #streamConfigPath;
    #httpConfigInstalled;
    #streamConfigInstalled;
    #deleted;

    #httpSslPort;
    #sslRenewInterval;
    #sslCertificateHash;
    #sslCertificate;
    #sslCertificateKey;

    constructor ( nginx, id, { httpPort, upstreams, serverNames, streamPorts, upstreamHttpPort, maxBodySize, cacheEnabled, cacheBypass } = {} ) {
        this.#nginx = nginx;
        this.#id = id;

        this.#httpPort = httpPort || this.#nginx.config.httpPort;

        this.#httpSslPort = this.#nginx.config.httpSslPort;

        if ( upstreams && !Array.isArray( upstreams ) ) upstreams = [upstreams];
        this.#upstreams = new Set( upstreams );

        if ( !serverNames ) {
            serverNames = [];
        }
        else if ( !Array.isArray( serverNames ) ) {
            serverNames = [serverNames];
        }
        this.#serverNames = new Set( serverNames.filter( serverName => serverName ).sort() );
        if ( !this.#serverNames.size ) this.#serverNames = null;

        if ( streamPorts && !Array.isArray( streamPorts ) ) streamPorts = [streamPorts];
        this.#streamPorts = new Set( streamPorts );

        this.#upstreamHttpPort = upstreamHttpPort || this.#nginx.config.upstreamHttpPort;
        this.#maxBodySize = maxBodySize || this.#nginx.config.maxBodySize;
        this.#cacheEnabled = !this.#nginx.config.cacheEnabled ? false : cacheEnabled ?? this.#nginx.config.cacheEnabled;
        this.#cacheBypass = cacheBypass ?? this.#nginx.config.cacheBypass;

        this.#httpConfigPath = this.#nginx.configsDir + "/" + this.id + ( this.#serverNames ? ".named" : ".unnamed" ) + ".http.nginx.conf";
        this.#streamConfigPath = this.#nginx.configsDir + "/" + this.id + ".stream.nginx.conf";
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get id () {
        return this.#id;
    }

    get httpPort () {
        return this.#httpPort;
    }

    get hasServerNames () {
        return !!this.#serverNames.size;
    }

    get upstreamsCount () {
        return this.#upstreams.size;
    }

    get isInstalled () {
        return this.#httpConfigInstalled || this.#streamConfigInstalled;
    }

    get isDeleted () {
        return this.#deleted;
    }

    // public
    async updateNginxConfigs () {
        if ( this.isDeleted ) return result( [500, `Service deleted`] );

        const mutex = this.#nginx.updateConfigMutex;

        await mutex.lock();

        var httpConfigChanged, streamConfigChanged;

        await this.#updateSsl();

        // install http server
        if ( this.#upstreams.size ) {
            httpConfigChanged = true;
            this.#httpConfigInstalled = true;

            const conf = httpConfigTemplate.render( {
                "id": this.#id + "-http",
                "listenIpFamily": this.#nginx.config.listenIpFamily,
                "upstreams": this.#upstreams,
                "upstreamHttpPort": this.#upstreamHttpPort,
                "httpPort": this.#httpPort,

                "privateHrrpServerUpstream": this.#nginx.privateHrrpServerUpstream,
                "acmeChallengesUrl": this.#nginx.acmeChallengesUrl,
                "httpSslPort": this.#httpSslPort,
                "sslCertificate": this.#sslCertificate + "",
                "sslCertificateKey": this.#sslCertificateKey + "",

                "serverName": this.#serverNames ? [...this.#serverNames].join( " " ) : null,
                "maxBodySize": DigitalSize.new( this.#maxBodySize ).toNginx(),
                "cacheEnabled": this.#cacheEnabled,
                "cacheBypass": this.#cacheBypass,
                "unixSocketsPath": this.#nginx.unixSocketsPath,
            } );

            // update server config
            fs.writeFileSync( this.#httpConfigPath, conf );
        }
        else {
            httpConfigChanged = this.#deleteHttpConfig();
        }

        // install stream server
        if ( this.#upstreams.size && this.#streamPorts.size ) {
            streamConfigChanged = true;
            this.#streamConfigInstalled = true;

            const conf = streamConfigTemplate.render( {
                "id": this.#id + "-stream",
                "listenIpFamily": this.#nginx.config.listenIpFamily,
                "upstreams": this.#upstreams,
                "streamPorts": this.#streamPorts,
            } );

            // update server config
            fs.writeFileSync( this.#streamConfigPath, conf );
        }
        else {
            streamConfigChanged = this.#deleteStreamConfig();
        }

        var res;

        // configs wasn't chanjed
        if ( !httpConfigChanged && !streamConfigChanged ) {
            res = result( 200 );
        }

        // configs was removed
        else if ( !this.isInstalled ) {
            this.#nginx.reload();

            res = result( 200 );
        }

        // configs was updated
        else {
            res = await this.#nginx.test();

            // config is valid
            if ( !res.ok ) {
                console.log( `Nginx config for server "${this.#id}" failed: ${res}` );

                this.#deleteHttpConfig();
                this.#deleteStreamConfig();
            }

            this.#nginx.reload();
        }

        mutex.unlock();

        return res;
    }

    delete () {
        if ( this.#deleted ) return;

        this.#deleted = true;

        var reload;

        this.#clearSsl();

        if ( this.#deleteHttpConfig() ) reload = true;
        if ( this.#deleteStreamConfig() ) reload = true;

        if ( reload ) this.#nginx.reload();

        this.#nginx.deleteServer( this.id );
    }

    async addUpstreams ( upstreams ) {
        if ( this.#deleted ) return result( 200 );

        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        const added = [];

        for ( const upstream of upstreams ) {
            if ( !this.#upstreams.has( upstream ) ) {
                this.#upstreams.add( upstream );

                added.push( upstream );
            }
        }

        if ( !added.length ) return result( 200 );

        return this.updateNginxConfigs();
    }

    async deleteUpstreams ( upstreams ) {
        if ( this.#deleted ) return result( 200 );

        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        const deleted = [];

        for ( const upstream of upstreams ) {
            if ( this.#upstreams.has( upstream ) ) {
                this.#upstreams.delete( upstream );

                deleted.push( upstream );
            }
        }

        if ( !deleted.length ) return result( 200 );

        return this.updateNginxConfigs();
    }

    // private
    #deleteHttpConfig () {
        if ( !this.#httpConfigInstalled ) return false;

        this.#httpConfigInstalled = false;

        fs.rmSync( this.#httpConfigPath, { "force": true } );

        return true;
    }

    #deleteStreamConfig () {
        if ( !this.#streamConfigInstalled ) return false;

        this.#streamConfigInstalled = false;

        fs.rmSync( this.#streamConfigPath, { "force": true } );

        return true;
    }

    async #updateSsl () {
        try {
            if ( !this.#serverNames ) throw false;

            // certs already exists
            if ( this.#sslCertificateHash ) return;

            const res = await this.#nginx.acme.getCertificate( [...this.#serverNames] );
            if ( !res.ok ) {
                console.log( `Nginx get certificates for server "${this.#id}" failed: ${res}` );

                throw false;
            }

            this.#clearSsl();
            this.#sslRenewInterval = setInterval( this.#renewSsl.bind( this ), renewInterval );

            this.#sslCertificateHash = res.data.hash;
            this.#sslCertificate = res.data.certificate;
            this.#sslCertificateKey = res.data.key;
        }
        catch ( e ) {
            this.#clearSsl();
        }
    }

    async #renewSsl () {
        const res = await this.#nginx.acme.getCertificate( [...this.#serverNames] );

        if ( !res.ok ) return;

        // not updated
        if ( this.#sslCertificateHash === res.data.hash ) return;

        this.#sslCertificateHash = res.data.hash;
        this.#sslCertificate = res.data.certificate;
        this.#sslCertificateKey = res.data.key;

        this.updateNginxConfigs();
    }

    #clearSsl () {
        clearInterval( this.#sslRenewInterval );
        this.#sslRenewInterval = null;

        this.#sslCertificateHash = null;
        this.#sslCertificate = "";
        this.#sslCertificateKey = "";
    }
}
