export default class NginxConfig {
    #nginx;

    #ports;
    #servers = [];
    #proxies = {};

    constructor ( nginx ) {
        this.#nginx = nginx;
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    // public
    useRouter ( port ) {
        this.#build();

        return this.#ports[ port ]?.router.enabled;
    }

    getServers () {
        this.#build();

        return this.#servers;
    }

    getProxies () {
        this.#build();

        return Object.values( this.#proxies );
    }

    getRouters () {
        this.#build();

        const routers = [];

        for ( const [ port, options ] of Object.entries( this.#ports ) ) {
            if ( !options.router.enabled ) continue;

            const router = {
                "port": +port,
                "proxyProtocol": options.proxyProtocol,
                "serverName": options.router.serverName,
                "defaultSocket": null,
                "defaultSslSocket": options.router.defaultSslSocket,
            };

            if ( options.router.defaultSocket ) {
                router.defaultSocket = options.router.defaultSocket;
            }
            else if ( options.servers[ "http" ] ) {
                router.defaultSocket = this.nginx.getListenAddress( "http", port, false );
            }

            routers.push( router );
        }

        return routers;
    }

    getDefaultHttpServers () {
        this.#build();

        const servers = [];

        for ( const [ port, options ] of Object.entries( this.#ports ) ) {
            if ( options.servers[ "http" ] && !options.hasDefaultHttpServer ) {
                servers.push( {
                    "port": +port,
                    "ssl": false,
                    "proxyProtocol": options.proxyProtocol,
                    "useRouter": this.useRouter( port ),
                } );
            }

            if ( options.servers[ "http-ssl" ] && !options.hasDefaultHttpSslServer ) {
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

    // private
    #build () {
        if ( this.#ports ) return;

        this.#ports = {
            "80": {
                "proxyProtocol": false,
                "hasDefaultHttpServer": false,
                "hasDefaultHttpSslServer": false,
                "servers": {
                    "http": 1,
                },
                "router": {
                    "enabled": false,
                    "serverName": {},
                    "defaultSocket": null,
                    "defaultSslSocket": null,
                },
            },
        };

        for ( const proxy of this.nginx.proxies ) {
            for ( const server of proxy.servers ) {
                this.#addServer( server );
            }
        }
    }

    #addServer ( server ) {

        // proxy has no upstreams
        if ( !server.proxy.hasUpstreams ) return;

        var port = this.#ports[ server.port ];

        // port already registered
        if ( port ) {
            try {

                // server is conflicted with the default server http:80
                if ( server.port === 80 && !( server.isHttp || server.ssl ) ) throw true;

                // udp can't be mixed with the other types
                if ( server.isUdp ) throw true;

                // check proxy protocol
                if ( port.proxyProtocol !== server.proxyProtocol ) throw true;

                // check default server
                if ( server.isDefaultServer ) {
                    if ( server.ssl ) {
                        if ( port.router.defaultSslSocket ) throw true;
                    }
                    else {
                        if ( port.router.defaultSocket ) throw true;
                    }
                }

                // check server names conflicrs
                if ( server.ssl && !server.isDefaultServer ) {
                    let hasUniqueServerName;

                    for ( const serverName of server.serverName ) {
                        if ( !port.router.serverName[ serverName ] ) {
                            hasUniqueServerName = true;

                            break;
                        }
                    }

                    if ( !hasUniqueServerName ) throw true;
                }
            }
            catch ( e ) {
                console.log( `Nginx server ignored: ${ server.proxy.id }, port: ${ server.port }` );

                return;
            }
        }

        // register port
        port = this.#ports[ server.port ] ||= {
            "proxyProtocol": false,
            "hasDefaultHttpServer": false,
            "hasDefaultHttpSslServer": false,
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
            if ( server.ssl ) {
                port.hasDefaultHttpSslServer = true;
            }
            else {
                port.hasDefaultHttpServer = true;
            }
        }

        port.servers[ server.type + ( server.ssl ? "-ssl" : "" ) ] ??= 0;
        port.servers[ server.type + ( server.ssl ? "-ssl" : "" ) ]++;

        // router settings
        if ( server.ssl ) {
            if ( server.isDefaultServer ) {
                port.router.defaultSslSocket = server.socketPath;
            }
            else {
                for ( const serverName of server.serverName ) {
                    port.router.serverName[ serverName ] ||= server.socketPath;
                }
            }
        }
        else {
            port.router.defaultSocket = server.socketPath;
        }

        // enable router
        if ( port.servers[ "http-ssl" ] ) {
            if ( port.servers[ "tcp-ssl" ] || port.servers[ "http" ] || port.servers[ "tcp" ] ) {
                port.router.enabled = true;
            }
        }
        else if ( port.servers[ "tcp-ssl" ] ) {
            if ( port.servers[ "tcp-ssl" ] > 1 || port.servers[ "http-ssl" ] || port.servers[ "http" ] || port.servers[ "tcp" ] ) {
                port.router.enabled = true;
            }
        }

        // register server
        this.#servers.push( server );

        // register proxy
        this.#proxies[ server.proxy.id ] ||= {
            "proxy": null,
            "options": {
                "hasHttpServers": false,
                "hasStreamServers": false,
            },
        };

        this.#proxies[ server.proxy.id ].proxy = server.proxy;

        if ( server.isHttp ) {
            this.#proxies[ server.proxy.id ].options.hasHttpServers = true;
        }
        else {
            this.#proxies[ server.proxy.id ].options.hasStreamServers = true;
        }

        return;
    }
}
