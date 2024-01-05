export default class NginxConfig {
    #nginx;
    #ports;
    #servers = [];
    #proxies = {};
    #routers = {};

    constructor ( nginx ) {
        this.#nginx = nginx;

        this.#ports = {
            "80": {
                "types": new Set( ["http"] ),
                "ssl": false,
                "proxyProtocol": false,
            },
            "443": {
                "types": new Set( ["http"] ),
                "ssl": true,
                "proxyProtocol": false,
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

    // for ( const [port, options] of Object.values( ports ) ) {

    //     // XXX
    //     // for ( const options of routers.values() ) {
    //     //     this.#writeRouterConfig( options );
    //     //     // / XXX
    //     //     this.#writeRouterConfig( {
    //     //         "port": 443,
    //     //         "serverName": {},
    //     //         "defaultSocket": this.getHttpsSocketPath,
    //     //     } );
    //     // }
    // }

    // XXX
    get routers () {
        return [];
    }

    // public
    addServer ( server ) {

        // proxy has no upstreams
        if ( !server.proxy.hasUpstreams ) return;

        var port = this.#ports[server.port];

        if ( port ) {
            if ( port.ssl !== !!server.ssl ) return;

            if ( port.proxyProtocol !== server.proxyProtocol ) return;

            // http
            if ( server.isHttp ) {
                if ( server.ssl ) {
                    if ( port.types.has( "udp" ) ) return;
                }
                else {
                    if ( port.types.has( "tcp" ) || port.types.has( "udp" ) ) return;
                }
            }

            // tcp
            else if ( server.isTcp ) {
                if ( server.ssl ) {
                    if ( port.types.has( "udp" ) ) return;
                }
                else {
                    return;
                }
            }

            // udp
            else {
                return;
            }
        }

        port = this.#ports[server.port] ||= {};

        // XXX
        // register router

        // register port
        port.types ||= new Set();
        port.types.add( server.type );

        port.ssl = !!server.ssl;

        port.proxyProtocol = server.proxyProtocol;

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
        return !!this.#routers[port];
    }
}
