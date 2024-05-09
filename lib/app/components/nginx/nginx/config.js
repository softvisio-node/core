var USE_LOCAL_SOCKET = false,
    LOCAL_ADDRESS = "127.0.0.5",
    LOCAL_PORT = 33000;

export default class NginxConfig {
    #nginx;

    #ports;
    #servers = [];
    #proxies = {};
    #localAddressPort = LOCAL_PORT;
    #localAddresses = {};

    constructor ( nginx ) {
        this.#nginx = nginx;
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
        this.#build();

        const routers = [];

        for ( const [ port, options ] of Object.entries( this.#ports ) ) {
            if ( !options.router.enabled ) continue;

            const router = {
                "port": +port,
                "serverName": options.router.serverName,
                "defaultLocalAddress": null,
                "defaultLocalSslAddress": options.router.defaultLocalSslAddress,
            };

            if ( options.router.defaultLocalAddress ) {
                router.defaultLocalAddress = options.router.defaultLocalAddress;
            }
            else if ( options.servers[ "http" ] ) {
                router.defaultLocalAddress = this.#getLocalAddress( "http", port, false );
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

        return servers;
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
                    "defaultLocalAddress": null,
                    "defaultLocalSslAddress": null,
                },
            },
        };

        for ( const proxy of this.nginx.proxies ) {
            for ( const server of proxy.servers ) {
                this.#addServer( server );
            }
        }

        this.#servers = this.#servers.map( server => {
            const options = {
                "localAddress": this.#useRouter( server.port ) ? this.#getServerLocalAddress( server ) : null,
            };

            return [ server, options ];
        } );
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
                if ( server.isHttp && port.httpProxyProtocol !== server.proxyProtocol ) throw true;

                // check default server
                if ( server.isDefaultServer ) {
                    if ( server.ssl ) {
                        if ( port.router.defaultLocalSslAddress ) throw true;
                    }
                    else {
                        if ( port.router.defaultLocalAddress ) throw true;
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
            "httpProxyProtocol": false,
            "hasDefaultHttpServer": false,
            "hasDefaultHttpSslServer": false,
            "servers": {},
            "router": {
                "enabled": false,
                "serverName": {},
                "defaultLocalAddress": null,
                "defaultLocalSslAddress": null,
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
                port.router.defaultLocalSslAddress = this.#getServerLocalAddress( server );
            }
            else {
                for ( const serverName of server.serverName ) {
                    port.router.serverName[ serverName ] ||= this.#getServerLocalAddress( server );
                }
            }
        }
        else {
            port.router.defaultLocalAddress = this.#getServerLocalAddress( server );
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

    #getServerLocalAddress ( server ) {
        if ( server.isHttp ) {
            return this.#getLocalAddress( "http", server.port, !!server.ssl );
        }
        else {
            return this.#getLocalAddress( server.proxy.id, server.port, !!server.ssl );
        }
    }

    #getLocalAddress ( name, port, ssl ) {
        if ( !USE_LOCAL_SOCKET ) {
            const id = name + "/" + port + "/" + ( ssl ? "ssl" : "no-ssl" );

            var address = this.#localAddresses[ id ];

            if ( !address ) {
                address = LOCAL_ADDRESS + ":" + this.#localAddressPort++;

                this.#localAddresses[ id ] = address;
            }

            return address;
        }
        else {
            let socketPath = "unix:" + this.#nginx.app.env.unixSocketsDir + `/nginx-${ name }-${ port }`;

            if ( ssl ) socketPath += "-ssl";

            socketPath += ".socket";

            return socketPath;
        }
    }

    #useRouter ( port ) {
        this.#build();

        return this.#ports[ port ]?.router.enabled;
    }
}
