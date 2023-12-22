import fs from "node:fs";
import ejs from "#lib/ejs";
import DigitalSize from "#lib/digital-size";
import Interval from "#lib/interval";
import net from "node:net";
import Mutex from "#lib/threads/mutex";
import crypto from "node:crypto";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

const httpConfigTemplate = ejs.fromFile( new URL( "../resources/server.http.nginx.conf", import.meta.url ) ),
    streamConfigTemplate = ejs.fromFile( new URL( "../resources/server.stream.nginx.conf", import.meta.url ) );

export default class NginxServer {
    #nginx;
    #id;
    #type;
    #port;
    #serverName;
    #defaultUpstreamPort;
    #upstreams = new Set();
    #maxBodySize;
    #cacheEnabled;
    #cacheBypass;

    #configPath;
    #isDeleted = false;
    #configHash;
    #pendingReload = false;
    #reloadMutex = new Mutex();

    #sslEnabled;
    #sslRenewInterval;
    #sslCertificateHash;
    #sslCertificate;
    #sslCertificateKey;

    constructor ( nginx, id, { type, port, serverName, defaultUpstreamPort, upstreams, maxBodySize, cacheEnabled, cacheBypass, sslEnabled = true } = {} ) {
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
        if ( !defaultUpstreamPort && this.isHttp ) defaultUpstreamPort = 80;
        this.#defaultUpstreamPort = this.#validatePort( defaultUpstreamPort );

        // upstreams
        this.#addUpstreams( upstreams );

        this.#maxBodySize = maxBodySize || this.#nginx.config.maxBodySize;

        this.#cacheEnabled = this.#nginx.config.cacheEnabled ? !!cacheEnabled : false;
        this.#cacheBypass = !!( cacheBypass ?? this.#nginx.config.cacheBypass );

        this.#sslEnabled = !!sslEnabled;
        if ( !this.#serverName.length ) this.#sslEnabled = false;

        if ( this.isHttp ) {
            this.#configPath = this.#nginx.configsDir + `/${this.#id}-${this.#port}`;

            if ( this.#serverName.length ) {
                this.#configPath += ".named";
            }
            else {
                this.#configPath += ".unnamed";
            }

            this.#configPath += ".http.nginx.conf";
        }
        else {
            this.#configPath = this.#nginx.configsDir + `/${this.#id}-${this.#port}.stream.nginx.conf`;
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

    // public
    // XXX streams config
    async reload () {
        var res;

        // server port is not defined
        if ( !this.#port ) return result( [500, `Server port not defined`] );

        const mutex = this.#nginx.updateConfigMutex;

        // lock nginx update
        await mutex.lock();

        if ( !this.#reloadMutex.tryLock() ) {
            this.#pendingReload = true;

            return this.#reloadMutex.wait();
        }

        let updated;

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
                    if ( this.#deleteConfig() ) updated = true;
                }
                else {
                    if ( this.isHttp ) {
                        config = httpConfigTemplate.render( {
                            "id": this.#id + "-http",
                            "listenIpFamily": this.#nginx.config.listenIpFamily,
                            "port": this.#port,
                            "serverName": this.#serverName.join( " " ),
                            "upstreams": this.#upstreams,

                            "maxBodySize": DigitalSize.new( this.#maxBodySize ).toNginx(),
                            "cacheEnabled": this.#cacheEnabled,
                            "cacheBypass": this.#cacheBypass,
                            "unixSocketsPath": this.#nginx.unixSocketsPath,

                            "privateHrrpServerUpstream": this.#nginx.privateHrrpServerUpstream,
                            "acmeChallengesUrl": this.#nginx.acmeChallengesUrl,
                            "sslCertificate": this.#sslCertificate + "",
                            "sslCertificateKey": this.#sslCertificateKey + "",
                        } );
                    }
                    else {

                        // XXX
                        config = streamConfigTemplate.render( {} );
                    }

                    // write config
                    if ( this.#writeConfig( config ) ) updated = true;

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
        if ( updated ) this.#nginx.reload();

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

        if ( updated ) await this.reload();

        return this;
    }

    async deleteUpstreams ( upstreams ) {
        const updated = this.#deleteUpstreams( upstreams );

        if ( updated ) await this.reload();

        return this;
    }

    // private
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

    #getUpstreamServer ( server ) {
        if ( !server ) return;

        var [address, port] = server.split( ":" );

        const ip = net.isIP( address );

        if ( !ip ) return;
        if ( this.#nginx.config.listenIpFamily && this.#nginx.config.listenIpFamily !== ip ) return;

        port ||= this.#defaultUpstreamPort;

        port = this.#validatePort( port );

        if ( !port ) return;

        return `${address}:${port}`;
    }

    #validatePort ( port ) {
        if ( !port ) return;

        port = Number( port );

        if ( port < 1 || port > 65535 ) return;

        return port;
    }

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

        fs.writeFileSync( this.#configPath, config );

        this.#configHash = hash;

        return true;
    }

    #deleteConfig () {
        if ( !this.isInstalled ) return false;

        fs.rmSync( this.#configPath, { "force": true } );

        this.#configHash = null;

        return true;
    }
}
