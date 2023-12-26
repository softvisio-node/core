import fs from "node:fs";
import ejs from "#lib/ejs";
import DigitalSize from "#lib/digital-size";
import Interval from "#lib/interval";
import net from "node:net";
import Mutex from "#lib/threads/mutex";
import crypto from "node:crypto";
import path from "node:path";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

const httpConfigTemplate = ejs.fromFile( new URL( "../resources/server.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../resources/server.stream.nginx.conf", import.meta.url ) );

const TYPES = new Set( ["http", "tcp", "udp"] );

export default class NginxServer {
    #nginx;
    #id;
    #type;
    #port;
    #serverName;
    #upstreamPort;
    #upstreamProxyProtocol;
    #upstreams = new Set();
    #maxBodySize;
    #cacheEnabled;
    #cacheBypass;

    #configPath;
    #mapConfigPath;
    #isDeleted = false;
    #configHash;
    #pendingReload = false;
    #reloadMutex = new Mutex();

    #sslEnabled;
    #sslRenewInterval;
    #sslCertificateHash;
    #sslCertificate;
    #sslCertificateKey;

    constructor ( nginx, id, { type, port, serverName, upstreamPort, upstreamProxyProtocol, maxBodySize, cacheEnabled, cacheBypass, sslEnabled } = {} ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#type = type;

        // port
        if ( !port && this.isHttp ) port = 80;
        this.#port = this.#validatePort( port );

        // names
        if ( !Array.isArray( serverName ) ) serverName = [serverName];
        this.#serverName = [...new Set( serverName )].filter( serverName => serverName ).sort();

        // upstream port
        if ( !upstreamPort && this.isHttp ) upstreamPort = 80;
        this.#upstreamPort = this.#validatePort( upstreamPort );

        this.#upstreamProxyProtocol = !!upstreamProxyProtocol;

        this.#maxBodySize = maxBodySize || this.#nginx.config.maxBodySize;

        // cache enabled
        if ( !this.#nginx.config.cacheEnabled ) {
            this.#cacheEnabled = false;
        }
        else {
            this.#cacheEnabled = !!( cacheEnabled ?? true );
        }

        this.#cacheBypass = !!( cacheBypass ?? this.#nginx.config.cacheBypass );

        // ssl enabled
        if ( this.#port === 443 ) {
            this.#sslEnabled = true;
        }
        else if ( this.isUdp ) {
            this.#sslEnabled = false;
        }
        else {
            if ( sslEnabled == null ) {
                this.#sslEnabled = this.#serverName.length;
            }
            else if ( !this.#serverName.length ) {
                this.#sslEnabled = false;
            }
            else {
                this.#sslEnabled = !!sslEnabled;
            }
        }

        // http
        if ( this.isHttp ) {
            if ( this.#serverName.length ) {
                this.#configPath = this.#nginx.configsDir + `/http/${this.#id}.nginx.conf`;
            }
            else {
                this.#configPath = this.#nginx.configsDir + `/http-default/${this.#id}.nginx.conf`;
            }
        }

        // stream
        else {
            this.#configPath = this.#nginx.configsDir + `/streams/${this.#id}.nginx.conf`;

            if ( this.#port === 443 && this.#serverName.length ) {
                this.#mapConfigPath = this.#nginx.configsDir + `/ssl-server-upstreams/${this.#id}.443.nginx.conf`;
            }
        }
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get id () {
        return this.#id;
    }

    get type () {
        return this.#type;
    }

    get isInstalled () {
        return !!this.#configHash;
    }

    get isDeleted () {
        return this.#isDeleted;
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

    get hasUpstreams () {
        return !!this.#upstreams.size;
    }

    // public
    validate () {
        if ( !TYPES.has( this.type ) ) return result( [400, `Server type is not valid`] );

        if ( this.#port === 80 && !this.isHttp ) result( [400, `Unable to user stream on port 80`] );

        if ( this.#port === 443 && this.isUdp ) result( [400, `Unable to user UDP on port 443`] );

        // server port is not defined
        if ( !this.#port ) return result( [500, `Server port not defined`] );

        if ( this.#sslEnabled && !this.#serverName.length ) return result( [400, `Server name is required for SSL`] );

        return result( 200 );
    }

    async reload () {
        var res;

        // validate
        res = this.validate();
        if ( !res ) return res;

        const mutex = this.#nginx.updateConfigMutex;

        // lock nginx update
        await mutex.lock();

        if ( !this.#reloadMutex.tryLock() ) {
            this.#pendingReload = true;

            return this.#reloadMutex.wait();
        }

        const configHash = this.#configHash;

        while ( true ) {
            this.#pendingReload = false;

            try {

                // server deleted
                if ( this.#isDeleted ) throw result( [400, `Server deleted`] );

                let config;

                // update certificated
                await this.#updateCertificates();

                // no upstreams
                if ( !this.#upstreams.size ) {
                    this.#deleteConfig();
                }
                else {
                    if ( this.isHttp ) {
                        config = httpConfigTemplate.render( {
                            "id": this.#id,
                            "listenIpFamily": this.#nginx.config.listenIpFamily,
                            "port": this.#port,
                            "serverName": this.#serverName.join( " " ),
                            "upstreams": this.#upstreams,
                            "unixSocketsPath": this.#nginx.unixSocketsPath,

                            // http settings
                            "maxBodySize": DigitalSize.new( this.#maxBodySize ).toNginx(),
                            "cacheEnabled": this.#cacheEnabled,
                            "cacheBypass": this.#cacheBypass,

                            // ssl
                            "sslCertificate": this.#sslCertificate + "",
                            "sslCertificateKey": this.#sslCertificateKey + "",
                            "privateHrrpServerUpstream": this.#nginx.privateHrrpServerUpstream,
                            "acmeChallengesUrl": this.#nginx.acmeChallengesUrl,
                        } );
                    }
                    else {
                        config = streamConfigTemplate.render( {
                            "id": this.#id,
                            "listenIpFamily": this.#nginx.config.listenIpFamily,
                            "port": this.#port,
                            "upstreams": this.#upstreams,
                            "unixSocketsPath": this.#nginx.unixSocketsPath,
                            "upstreamProxyProtocol": this.#upstreamProxyProtocol,
                            "udp": this.isUdp,

                            // ssl
                            "sslEnabled": this.#sslEnabled,
                            "sslCertificate": this.#sslCertificate + "",
                            "sslCertificateKey": this.#sslCertificateKey + "",
                        } );
                    }

                    // write config
                    const updated = this.#writeConfig( config );

                    // config updated
                    if ( updated ) {

                        // test
                        res = await this.#nginx.test();

                        // test failed
                        if ( !res.ok ) {
                            console.log( `Nginx config for server "${this.#id}" failed: ${res}` );

                            this.#deleteConfig();

                            throw res;
                        }
                    }
                }

                res = result( 200 );
            }
            catch ( e ) {
                res = result.catch( e, { "keepError": true, "silent": true } );
            }

            if ( !this.#pendingReload ) break;
        }

        // reload nginx
        if ( configHash !== this.#configHash ) this.#nginx.reload();

        mutex.unlock();

        this.#reloadMutex.unlock( res );

        return res;
    }

    async delete () {
        if ( this.#isDeleted ) return;

        this.#isDeleted = true;

        await this.#nginx.deleteServer( this.id );

        if ( !this.#deleteConfig() ) return;

        return this.nginx.reload();
    }

    async addUpstreams ( upstreams ) {
        const updated = this.#addUpstreams( upstreams );

        if ( updated ) {
            return this.reload();
        }
        else {
            return result( 200 );
        }
    }

    async deleteUpstreams ( upstreams ) {
        const updated = this.#deleteUpstreams( upstreams );

        if ( updated ) {
            return this.reload();
        }
        else {
            return result( 200 );
        }
    }

    // private
    #addUpstreams ( upstreams ) {
        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        var updated = false;

        for ( let upstream of upstreams ) {
            upstream = this.#getUpstreamServer( upstream );

            if ( !upstream ) continue;

            if ( this.#upstreams.has( upstream ) ) continue;

            this.#upstreams.add( upstream );

            updated = true;
        }

        return updated;
    }

    #deleteUpstreams ( upstreams ) {
        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        var updated = false;

        for ( let upstream of upstreams ) {
            upstream = this.#getUpstreamServer( upstream );

            if ( !upstream ) continue;

            if ( !this.#upstreams.has( upstream ) ) continue;

            this.#upstreams.delete( upstream );

            updated = true;
        }

        return updated;
    }

    #writeConfig ( config ) {
        if ( this.#isDeleted ) return false;

        const hash = crypto.createHash( "md5" ).update( config ).digest( "hex" );

        if ( this.#configHash === hash ) return false;

        fs.mkdirSync( path.dirname( this.#configPath ), { "recursive": true } );

        fs.writeFileSync( this.#configPath, config );

        if ( this.#mapConfigPath ) {
            fs.mkdirSync( path.dirname( this.#mapConfigPath ), { "recursive": true } );

            fs.writeFileSync( this.#mapConfigPath, this.#serverName.map( serverName => `"${serverName}" "${this.#id}";\n` ).join( "" ) );
        }

        this.#configHash = hash;

        return true;
    }

    #deleteConfig () {
        if ( !this.isInstalled ) return false;

        fs.rmSync( this.#configPath, { "force": true } );

        if ( this.#mapConfigPath ) fs.rmSync( this.#mapConfigPath, { "force": true } );

        this.#configHash = null;

        return true;
    }

    #getUpstreamServer ( server ) {
        if ( !server ) return;

        // unix socket
        if ( server.startsWith( "unix:" ) ) {
            return server;
        }

        // ip address
        else {
            var [address, port] = server.split( ":" );

            const ip = net.isIP( address );

            if ( !ip ) return;
            if ( this.#nginx.config.listenIpFamily && this.#nginx.config.listenIpFamily !== ip ) return;

            port ||= this.#upstreamPort;

            port = this.#validatePort( port );

            if ( !port ) return;

            return `${address}:${port}`;
        }
    }

    #validatePort ( port ) {
        if ( !port ) return;

        port = Number( port );

        if ( port < 1 || port > 65535 ) return;

        return port;
    }

    async #updateCertificates () {
        try {
            if ( !this.#sslEnabled ) throw false;

            // certs already exists
            if ( this.#sslCertificateHash ) return;

            const res = await this.#nginx.acme.getCertificate( [...this.#serverName] );
            if ( !res.ok ) {
                console.log( `Nginx get certificates for server "${this.#id}" failed: ${res}` );

                throw false;
            }

            this.#clearCertificates();
            this.#sslRenewInterval = setInterval( this.#renewCertificates.bind( this ), renewInterval );

            this.#sslCertificateHash = res.data.hash;
            this.#sslCertificate = res.data.certificate;
            this.#sslCertificateKey = res.data.key;
        }
        catch ( e ) {
            this.#clearCertificates();
        }
    }

    async #renewCertificates () {
        const res = await this.#nginx.acme.getCertificate( [...this.#serverName] );

        if ( !res.ok ) return;

        // not updated
        if ( this.#sslCertificateHash === res.data.hash ) return;

        this.#sslCertificateHash = res.data.hash;
        this.#sslCertificate = res.data.certificate;
        this.#sslCertificateKey = res.data.key;

        this.reload();
    }

    #clearCertificates () {
        clearInterval( this.#sslRenewInterval );
        this.#sslRenewInterval = null;

        this.#sslCertificateHash = null;
        this.#sslCertificate = "";
        this.#sslCertificateKey = "";
    }
}
