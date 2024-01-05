export default class NginxConfig {
    #nginx;
    #ports;
    #servers = [];
    #proxies = {};

    constructor ( nginx ) {
        this.#nginx = nginx;

        this.#ports = {
            "80": {
                "ssl": false,
                "proxyProtocol": false,
                "servers": {
                    "http": 1,
                },
            },
            "443": {
                "ssl": true,
                "proxyProtocol": false,
                "servers": {
                    "http": 1,
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

    get routers () {
        const routers = [];

        for ( const port in this.#ports ) {
            if ( !this.isRouterPort( port ) ) continue;

            const router = {
                port,
                "proxyProtocol": this.#ports[port].proxyProtocol,
                "serverName": {},
            };

            if ( this.#ports[port].servers.http ) {
                router.defaultSocket = this.nginx.getHttpsSocketPath( port );
            }
            else {
                router.defaultSocket = this.#ports[port].tcpServerName?.[""];
            }

            router.serverName = { ...( this.#ports[port].tcpServerName || {} ) };

            delete router.serverName[""];

            routers.push( router );
        }

        return routers;
    }

    // public
    addServer ( server ) {

        // proxy has no upstreams
        if ( !server.proxy.hasUpstreams ) return;

        var port = this.#ports[server.port];

        if ( port ) {
            try {
                if ( port.ssl !== !!server.ssl ) throw server;

                if ( port.proxyProtocol !== server.proxyProtocol ) throw server;

                // http
                if ( server.isHttp ) {
                    if ( server.ssl ) {
                        if ( port.servers.udp ) throw server;
                    }
                    else {
                        if ( port.servers.tcp || port.servers.udp ) throw server;
                    }
                }

                // tcp
                else if ( server.isTcp ) {
                    if ( server.ssl ) {
                        if ( port.servers.udp ) throw server;
                    }
                    else {
                        throw server;
                    }
                }

                // udp
                else {
                    throw server;
                }
            }
            catch ( e ) {
                console.log( `Nginx server ignored: ${server.proxy.id}, port: ${server.port}` );

                return;
            }
        }

        // register port
        port = this.#ports[server.port] ||= {};

        port.servers ||= {};
        port.servers[server.type] ??= 0;
        port.servers[server.type]++;

        port.ssl = !!server.ssl;

        port.proxyProtocol = server.proxyProtocol;

        if ( server.ssl && server.isTcp ) {
            port.tcpServerName ||= {};

            if ( server.serverName.length ) {
                for ( let serverName of server.serverName ) {

                    // XXX
                    if ( serverName.startsWith( "*." ) ) {
                        serverName = "~" + serverName;
                    }

                    port.tcpServerName[serverName] = server.socketPath;
                }
            }
            else {
                port.tcpServerName[""] = server.socketPath;
            }
        }

        // register server
        this.#servers.push( server );

        // register proxy
        this.#proxies[server.proxy.id] ||= {};

        this.#proxies[server.proxy.id].proxy = server.proxy;

        this.#proxies[server.proxy.id].options ||= {};

        if ( server.isHttp ) {
            this.#proxies[server.proxy.id].options.hasHttpServers = true;
        }
        else {
            this.#proxies[server.proxy.id].options.hasStreamServers = true;
        }
    }

    isRouterPort ( port ) {
        port = this.#ports[port];

        if ( !port ) return false;

        if ( !port.ssl ) return false;

        if ( port.servers.tcp > 1 ) return true;

        if ( port.servers.http && port.servers.tcp ) return true;

        return false;
    }
}
