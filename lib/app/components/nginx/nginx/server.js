export default class NginxServer {
    #nginx;
    #id;
    #names;
    #clientMaxBodySize;
    #cacheEnabled;
    #upstreamCacheStatus;
    #cacheBypass;

    constructor ( nginx, id, names, { clientMaxBodySize, cacheEnabled, upstreamCacheStatus, cacheBypass } = {} ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#names = names;
        this.#clientMaxBodySize = clientMaxBodySize;
        this.#cacheEnabled = cacheEnabled;
        this.#upstreamCacheStatus = upstreamCacheStatus;
        this.#cacheBypass = cacheBypass;
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get id () {
        return this.#id;
    }

    get names () {
        return this.#names;
    }

    // public
    delete () {}

    addUpstreams ( upstreams ) {}

    deleteUpstreams ( upstreams ) {}
}
