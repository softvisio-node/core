import fs from "node:fs";
import ejs from "#lib/ejs";
import DefaultServer from "./proxy/default-server.js";

const reouterConfigTemplate = ejs.fromFile( new URL( "../resources/server.stream-router.nginx.conf", import.meta.url ) );

export default class NginxConfig {
    #nginx;
    #useLocalSocket;
    #localAddress;
    #localAddressPort;

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

        this.#build();
    }

    // properties
    get app () {
        return this.#nginx.app;
    }

    get nginx () {
        return this.#nginx;
    }

    async generate () {
        return this.#build();
    }

    // private
    // XXX
    async #build () {
        const groups = {},
            ports = {};

        // add ACME
        if ( this.app.acme?.httpEnabled ) {
            const id = `80/http/false/false`;

            groups[ id ] = {
                id,
                "port": 80,
                "type": "http",
                "ssl": false,
                "proxyProtocol": false,
                "serverName": new Map(),
                "localAddress": null,
            };
        }

        // create server groups
        for ( const proxy of this.nginx.proxies ) {
            for ( const server of proxy.servers ) {

                // proxy has no upstreams
                if ( !server.proxy.hasUpstreams ) continue;

                const id = `${ server.port }/${ server.type }/${ !!server.ssl }/${ !!server.proxyProtocol }`;

                // init group
                groups[ id ] ??= {
                    id,
                    "port": server.port,
                    "type": server.type,
                    "ssl": !!server.ssl,
                    "proxyProtocol": !!server.proxyProtocol,
                    "serverName": new Map(),
                    "localAddress": null,
                };

                const group = groups[ id ];

                // add server
                if ( server.isDefaultServer ) {
                    if ( group.serverName.has( "" ) ) continue;

                    group.serverName.set( "", server );
                }
                else {
                    for ( const serverName of server.serverName ) {
                        if ( group.serverName.has( serverName ) ) continue;

                        group.serverName.set( serverName, server );
                    }
                }
            }
        }

        // add group default servers for http and ssl groups
        for ( const group of Object.values( groups ) ) {
            if ( group.serverName.has( "" ) ) continue;

            if ( group.type === "http" || group.ssl ) {

                // create default server
                group.serverName.set(
                    "",
                    new DefaultServer( this.nginx, {
                        "port": group.port,
                        "type": group.type,
                        "proxyProtocol": group.proxyProtocol,
                        "sslEnabled": group.ssl,
                    } )
                );
            }
        }

        // create ports
        for ( const group of Object.values( groups ) ) {

            // init port
            ports[ group.port ] ??= {
                "port": group.port,
                "isUdp": null,
                "groups": new Set(),
                "defaultGroup": null,
                "defaultSslGroup": null,
            };

            const port = ports[ group.port ];

            // init udp
            if ( port.isUdp == null ) {
                port.isUdp = group.type === "udp";
            }

            // udp port / group can not be mixed
            else if ( port.isUdp || group.type === "udp" ) {
                continue;
            }

            // SSL group
            if ( group.ssl ) {
                if ( group.serverName.has( "" ) ) {
                    port.defaultSslGroup ??= group;
                }
            }

            // non-SSL group
            else {

                // port can contain only 1 non-SSL servers group
                if ( port.defaultGroup ) {
                    continue;
                }
                else {
                    port.defaultGroup = group;
                }
            }

            port.groups.add( group );
        }

        // create routers
        for ( const port of Object.values( ports ) ) {

            // use router if port server groups size > 1
            if ( port.groups.size <= 1 ) continue;

            const router = ( port.router = {
                "port": port.port,
                "default": null,
                "defaultSsl": null,
                "serverName": new Map(),
            } );

            for ( const group of port.groups ) {
                group.localAddress = this.#createGroupLocalAddress( group );

                for ( const serverName of group.serverName.keys() ) {

                    // ignore default servers
                    if ( !serverName ) continue;

                    if ( router.serverName.has( serverName ) ) continue;

                    router.serverName.set( serverName, group.localAddress );
                }
            }

            router.default = port.defaultGroup?.localAddress;
            router.defaultSsl = port.defaultSslGroup?.localAddress;
        }

        for ( const port of Object.values( ports ) ) {
            for ( const group of port.groups ) {
                const promises = [];

                // generate servers
                for ( const server of group.serverName.values() ) {
                    promises.push( server.writeConfig( {
                        "localAddress": group.localAddress,
                    } ) );
                }

                await Promise.all( promises );
            }

            // XXX generate upstreams
            // for ( const { proxy, options } of config.proxies ) {
            // proxy.writeConfig( options );
            // }

            // generate routers
            if ( port.router ) {
                const config = reouterConfigTemplate.render( {
                    "nginx": this.nginx,
                    "router": port.router,
                } );

                fs.mkdirSync( this.nginx.configsDir + `/stream-servers`, { "recursive": true } );

                fs.writeFileSync( this.nginx.configsDir + `/stream-servers/_router-${ port.port }.nginx.conf`, config );
            }
        }

        // console.log( groups );
        // console.log( ports );
        process.exit();
    }

    #createGroupLocalAddress ( group ) {
        const port = this.#localAddressPort++;

        if ( this.#useLocalSocket ) {
            return "unix:" + this.#nginx.app.env.unixSocketsDir + `/nginx-${ port }.socket`;
        }
        else {
            return this.#localAddress + ":" + port;
        }
    }
}
