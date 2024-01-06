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
                "servers": {
                    "http": 1,
                },
                "router": {
                    "enabled": false,
                    "serverName": {},
                    "defaultSocket": this.#nginx.getSocketPath( "http", 80, false ),
                },
            },
            "443": {
                "proxyProtocol": false,
                "servers": {
                    "http-ssl": 1,
                },
                "router": {
                    "enabled": false,
                    "serverName": {},
                    "defaultSocket": this.#nginx.getSocketPath( "https", 443, true ),
                },
            },
        };
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get servers () {
        return this.#servers;
    }

    get proxies () {
        return Object.values( this.#proxies );
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
                    if ( port.servers.tcp ) throw true;
                    if ( port.servers.udp ) throw true;
                }

                // tcp
                else if ( server.isTcp ) {
                    if ( port.servers.http ) throw true;
                    if ( port.servers.tcp ) throw true;
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
            "servers": {},
            "router": {
                "enabled": false,
                "serverName": {},
                "defaultSocket": null,
            },
        };

        port.proxyProtocol = server.proxyProtocol;

        port.servers[server.type + ( server.ssl ? "-ssl" : "" )] ??= 0;
        port.servers[server.type + ( server.ssl ? "-ssl" : "" )]++;

        if ( server.ssl ) {
            if ( server.serverName.length ) {
                for ( const serverName of server.serverName ) {
                    port.router.serverName[serverName] = server.socketPath;
                }
            }
            else {
                port.router.defaultSocket = server.socketPath;
            }
        }
        else {
            port.router.defaultSocket = server.socketPath;
        }

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

    getRouters () {
        const routers = [];

        for ( const [port, options] of Object.entries( this.#ports ) ) {
            if ( !options.router.enabled ) continue;

            routers.push( {
                port,
                "proxyProtocol": options.proxyProtocol,
                "serverName": options.router.serverName,
                "defaultSocket": options.router.defaultSocket,
            } );
        }

        return routers;
    }
}
