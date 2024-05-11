export default class NginxConfig {
    #nginx;

    #ports;
    #servers = [];
    #proxies = {};
    #routers;
    #defaultHttpServers;
    #useLocalSocket;
    #localAddress;
    #localAddressPort;
    #localAddresses = {};

    constructor ( nginx ) {
        this.#nginx = nginx;

        if ( this.#nginx.config.localAddress === "unix:" ) {
            this.#useLocalSocket = true;
        }
        else {
            this.#useLocalSocket = false;

            const url = new URL( "tcp://" + this.#nginx.config.localAddress );

            this.#localAddress = url.hostname;
            this.#localAddressPort = +url.port;
        }
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    // public
    getServers () {
        this.#build();

        return this.#servers;
    }

    getProxies () {
        this.#build();

        return Object.values( this.#proxies );
    }

    getRouters () {
        if ( !this.#routers ) {
            this.#build();

            const routers = [];

            for ( const [ port, options ] of Object.entries( this.#ports ) ) {
                if ( !options.router.enabled ) continue;

                const router = {
                    "port": +port,
                    "serverName": {},
                    "defaultLocalAddress": null,
                    "defaultLocalSslAddress": this.#getServerLocalAddress( options.router.defaultSslServer ),
                };

                for ( const [ serverName, server ] of Object.entries( options.router.serverName ) ) {
                    router.serverName[ serverName ] = this.#getServerLocalAddress( server );
                }

                if ( options.router.defaultServer ) {
                    router.defaultLocalAddress = this.#getServerLocalAddress( options.router.defaultServer );
                }
                else if ( options.servers[ "http" ] ) {
                    router.defaultLocalAddress = this.#getLocalAddress( "http", port, false );
                }

                routers.push( router );
            }

            this.#routers = routers;
        }

        return this.#routers;
    }

    getDefaultHttpServers () {
        if ( !this.#defaultHttpServers ) {
            this.#build();

            const servers = [];

            for ( const [ port, options ] of Object.entries( this.#ports ) ) {
                if ( options.servers[ "http" ] && !options.hasDefaultHttpServer ) {
                    servers.push( {
                        "port": +port,
                        "ssl": false,
                        "proxyProtocol": options.httpProxyProtocol,
                        "localAddress": this.#useRouter( port ) ? this.#getLocalAddress( "http", port, false ) : null,
                    } );
                }

                if ( options.servers[ "http-ssl" ] && !options.hasDefaultHttpSslServer ) {
                    servers.push( {
                        "port": +port,
                        "ssl": true,
                        "proxyProtocol": options.httpProxyProtocol,
                        "localAddress": this.#useRouter( port ) ? this.#getLocalAddress( "http", port, true ) : null,
                    } );
                }
            }

            this.#defaultHttpServers = servers;
        }

        return this.#defaultHttpServers;
    }

    // private
    #build () {
        if ( this.#ports ) return;

        this.#ports = {
            "80": {
                "httpProxyProtocol": false,
                "hasDefaultHttpServer": false,
                "hasDefaultHttpSslServer": false,
                "servers": {
                    "http": 1,
                },
                "router": {
                    "enabled": false,
                    "serverName": {},
                    "defaultServer": null,
                    "defaultSslServer": null,
                },
            },
        };

        for ( const proxy of this.nginx.proxies ) {
            for ( const server of proxy.servers ) {
                this.#addServer( server );
            }
        }

        this.#buildServers();
    }

    #addServer ( server ) {

        // proxy has no upstreams
        if ( !server.proxy.hasUpstreams ) return;

        var port = this.#ports[ server.port ];

        // port already registered
        if ( port ) {
            try {

                // server is conflicted with the default server http:80
                if ( server.port === 80 && !( server.isHttp || server.ssl ) ) throw `port 80 must be HTTP, non-SSQL `;

                // udp can't be mixed with the other types
                if ( server.isUdp ) throw `UDP port conflict`;

                // check proxy protocol
                if ( server.isHttp && port.httpProxyProtocol !== server.proxyProtocol ) throw `HTTP port proxy protocol conflict`;

                // check default server
                if ( server.isDefaultServer ) {
                    if ( server.ssl ) {
                        if ( port.router.defaultSslServer ) throw `default SSL server conflict`;
                    }
                    else {
                        if ( port.router.defaultServer ) throw `default non-SSL server conflict`;
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

                    if ( !hasUniqueServerName ) throw `server names conflict`;
                }
            }
            catch ( e ) {
                console.log( `Nginx server ignored: ${ server.proxy.id }, port: ${ server.port }, reason: ${ e }` );

                return;
            }
        }

        // register port
        port = this.#ports[ server.port ] ||= {
            "httpProxyProtocol": false,
            "hasDefaultHttpServer": false,
            "hasDefaultHttpSslServer": false,
            "servers": {},
            "router": {
                "enabled": false,
                "serverName": {},
                "defaultServer": null,
                "defaultSslServer": null,
            },
        };

        if ( server.isHttp ) port.httpProxyProtocol = server.proxyProtocol;

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
                port.router.defaultSslServer = server;
            }
            else {
                for ( const serverName of server.serverName ) {
                    port.router.serverName[ serverName ] ||= server;
                }
            }
        }
        else {
            port.router.defaultServer = server;
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
    }

    #buildServers () {
        this.#servers = this.#servers.map( server => {
            const options = {
                "localAddress": this.#useRouter( server.port ) ? this.#getServerLocalAddress( server ) : null,
            };

            return [ server, options ];
        } );
    }

    #getServerLocalAddress ( server ) {
        if ( !server ) return null;

        if ( server.isHttp ) {
            return this.#getLocalAddress( "http", server.port, !!server.ssl );
        }
        else {
            return this.#getLocalAddress( server.proxy.id, server.port, !!server.ssl );
        }
    }

    #getLocalAddress ( name, port, ssl ) {
        const id = name + "-" + port + ( ssl ? "-ssl" : "" );

        if ( !this.#useLocalSocket ) {
            var address = this.#localAddresses[ id ];

            if ( !address ) {
                address = this.#localAddress + ":" + this.#localAddressPort++;

                this.#localAddresses[ id ] = address;
            }

            return address;
        }
        else {
            return "unix:" + this.#nginx.app.env.unixSocketsDir + `/nginx-${ id }.socket`;
        }
    }

    #useRouter ( port ) {
        this.#build();

        return this.#ports[ port ]?.router.enabled;
    }
}
