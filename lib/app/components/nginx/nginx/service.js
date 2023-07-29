export default class NginxService {
    #nginx;
    #config;
    #id;
    #upstreams = new Set();

    constructor ( nginx, config ) {
        this.#nginx = nginx;
        this.#config = config;
    }

    static getId ( names ) {
        if ( !Array.isArray( names ) ) names = [name];

        return names.sort()[0];
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get config () {
        return this.#config;
    }

    get id () {
        this.#id ??= this.constructor.getId( this.#config.serverName );

        return this.#id;
    }

    // public
    addUpstream () {}

    deleteUpstream () {}

    deleteService () {}
}
