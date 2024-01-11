export default class NginxConfig {
    #nginx;
    #ports;
    #servers = [];
    #proxies = {};

    constructor ( nginx ) {
        this.#nginx = nginx;

        this.#ports = {
            "80": {
                "proxyProtocol": false,
                "hasDefaultHttpServer": false,
                "servers": {
                    "http": 1,
                },
                "router": {
                    "enabled": false,
                    "serverName": {},
                    "defaultSocket": this.#nginx.getSocketPath( "http", 80, false ),
                    "defaultSslSocket": null,
                },
            },
            "443": {
                "proxyProtocol": false,
                "hasDefaultHttpServer": false,
                "servers": {
                    "http-ssl": 1,
                },
                "router": {
                    "enabled": false,
                    "serverName": {},
                    "defaultSocket": null,
                    "defaultSslSocket": this.#nginx.getSocketPath( "https", 443, true ),
                },
            },
        };
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    // public
    addServer ( server ) {

        // proxy has no upstreams
        if ( !server.proxy.hasUpstreams ) return;

        var port = this.#ports[server.port];

        if ( port ) {
            try {
                if ( port.proxyProtocol !== server.proxyProtocol ) throw true;

                // http
                if ( server.isHttp ) {
                    if ( server.isDefaultServer && port.hasDefaultHttpServer ) throw true;

                    if ( !server.ssl && port.servers.tcp ) throw true;
                    if ( port.servers.udp ) throw true;
                }

                // tcp
                else if ( server.isTcp ) {
                    if ( !server.ssl && port.servers.http ) throw true;
                    if ( !server.ssl && port.servers.tcp ) throw true;
                    if ( port.servers.udp ) throw true;
                }

                // udp
                else {
                    throw true;
                }
            }
            catch ( e ) {
                console.log( `Nginx server ignored: ${server.proxy.id}, port: ${server.port}` );

                return;
            }
        }

        // register port
        port = this.#ports[server.port] ||= {
            "proxyProtocol": false,
            "hasDefaultHttpServer": false,
            "servers": {},
            "router": {
                "enabled": false,
                "serverName": {},
                "defaultSocket": null,
                "defaultSslSocket": null,
            },
        };

        port.proxyProtocol = server.proxyProtocol;

        if ( server.isHttp && server.isDefaultServer ) {
            port.hasDefaultHttpServer = true;
        }

        port.servers[server.type + ( server.ssl ? "-ssl" : "" )] ??= 0;
        port.servers[server.type + ( server.ssl ? "-ssl" : "" )]++;

        // router settings
        if ( server.ssl ) {
            if ( server.isDefaultServer ) {
                port.router.defaultSslSocket = server.socketPath;
            }
            else {
                for ( const serverName of server.serverName ) {
                    port.router.serverName[serverName] = server.socketPath;
                }
            }
        }
        else {
            port.router.defaultSocket = server.socketPath;
        }

        // enable router
        if ( port.servers["http-ssl"] ) {
            if ( port.servers["tcp-ssl"] || port.servers["http"] || port.servers["tcp"] ) {
                port.router.enabled = true;
            }
        }
        else if ( port.servers["tcp-ssl"] ) {
            if ( port.servers["tcp-ssl"] > 1 || port.servers["http-ssl"] || port.servers["http"] || port.servers["tcp"] ) {
                port.router.enabled = true;
            }
        }

        // register server
        this.#servers.push( server );

        // register proxy
        this.#proxies[server.proxy.id] ||= {
            "proxy": null,
            "options": {
                "hasHttpServers": false,
                "hasStreamServers": false,
            },
        };

        this.#proxies[server.proxy.id].proxy = server.proxy;

        if ( server.isHttp ) {
            this.#proxies[server.proxy.id].options.hasHttpServers = true;
        }
        else {
            this.#proxies[server.proxy.id].options.hasStreamServers = true;
        }
    }

    useRouter ( port ) {
        return this.#ports[port]?.router.enabled;
    }

    getServers () {
        return this.#servers;
    }

    getProxies () {
        return Object.values( this.#proxies );
    }

    getRouters () {
        const routers = [];

        for ( const [port, options] of Object.entries( this.#ports ) ) {
            if ( !options.router.enabled ) continue;

            routers.push( {
                port,
                "proxyProtocol": options.proxyProtocol,
                "serverName": options.router.serverName,
                "defaultSocket": options.router.defaultSocket,
                "defaultSslSocket": options.router.defaultSslSocket,
            } );
        }

        return routers;
    }

    getDefaultHttpServers () {
        const servers = [];

        for ( const [port, options] of Object.entries( this.#ports ) ) {
            if ( options.hasDefaultHttpServer ) continue;

            if ( options.servers["http"] ) {
                servers.push( {
                    "port": +port,
                    "ssl": false,
                    "proxyProtocol": options.proxyProtocol,
                    "useRouter": this.useRouter( port ),
                } );
            }
            else if ( options.servers["http-ssl"] ) {
                servers.push( {
                    "port": +port,
                    "ssl": true,
                    "proxyProtocol": options.proxyProtocol,
                    "useRouter": this.useRouter( port ),
                } );
            }
        }

        return servers;
    }
}
