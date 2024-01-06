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
            },
            "443": {
                "proxyProtocol": false,
                "servers": {
                    "http-ssl": 1,
                },
                "router": {
                    "serverName": {},
                    "defaultSocket": null,
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
    // XXX
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
        port = this.#ports[server.port] ||= {};

        port.proxyProtocol = server.proxyProtocol;

        port.servers ||= {};
        port.servers[server.type + ( server.ssl ? "-ssl" : "" )] ??= 0;
        port.servers[server.type + ( server.ssl ? "-ssl" : "" )]++;

        if ( server.ssl ) {
            port.router ||= {};
            port.router.serverName ||= {};

            if ( server.serverName.length ) {
                for ( const serverName of server.serverName ) {
                    port.router.serverName[serverName] = server.socketPath;
                }
            }
            else {
                port.router.defaultSocket = server.socketPath;
            }
        }

        // XXX
        if ( server.ssl && server.isTcp ) {
            port.tcpServerName ||= {};

            if ( server.serverName.length ) {
                for ( const serverName of server.serverName ) {
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

    // XXX
    useRouter ( port ) {
        port = this.#ports[port];

        if ( !port ) return false;

        if ( !port.ssl ) return false;

        if ( port.servers.tcp > 1 ) return true;

        if ( port.servers.http && port.servers.tcp ) return true;

        return false;
    }

    // XXX
    getRouters () {
        const routers = [];

        for ( const port in this.#ports ) {
            if ( !this.useRouter( port ) ) continue;

            const router = {
                port,
                "proxyProtocol": this.#ports[port].proxyProtocol,
                "serverName": { ...( this.#ports[port].tcpServerName || {} ) },
                "defaultSocket": null,
            };

            if ( this.#ports[port].servers.http ) {
                router.defaultSocket = this.nginx.getHttpsSocketPath( port );
            }
            else {
                router.defaultSocket = router.serverName[""];
            }

            delete router.serverName[""];

            routers.push( router );
        }

        return routers;
    }
}
