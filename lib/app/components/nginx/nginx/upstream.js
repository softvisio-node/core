export default class NginxUpstrea {
    #nginx;
    #id;
    #type;
    #sourcePort;
    #targetPort;
    #serverName;
    #address;

    constructor ( { nginx, type, sourcePort, targetPort, serverName, address } = {} ) {
        this.#nginx = nginx;
        this.#type = type;
        this.#address = address;

        if ( !sourcePort ) {
            if ( this.isHttp ) {
                sourcePort = [80, 443];
            }
            else {
                sourcePort = [];
            }
        }
        if ( !Array.isArray( sourcePort ) ) sourcePort = [sourcePort];
        sourcePort = new Set( sourcePort.filter( sourcePort => sourcePort ) );

        this.#targetPort = targetPort;
        if ( !this.#targetPort && this.isHttp ) this.#targetPort = 80;

        if ( Array.isArray( serverName ) ) serverName = [serverName];
        serverName = new Set( serverName.filter( serverName => serverName ).sort() );
        this.#serverName = serverName;
    }

    // propertues
    get nginx () {
        return this.#nginx;
    }

    get id () {
        return this.#id;
    }

    get type () {
        return this.#type;
    }

    get sourcePort () {
        return this.#sourcePort;
    }

    get targetPort () {
        return this.#targetPort;
    }

    get serverName () {
        return this.#serverName;
    }

    get address () {
        return this.#address;
    }

    get isHttp () {
        return this.#type === "http";
    }

    get isTcp () {
        return this.#type === "tcp";
    }

    get isUdp () {
        return this.#type === "udp";
    }
}
