class Proxy {
    #host;
    #port;
    #username;
    #password;

    constructor ( host, port, username, password ) {
        this.#host = host;
        this.#port = port;
        this.#username = username;
        this.#password = password;
    }

    get host () {
        return this.#host;
    }

    get port () {
        return this.#port;
    }

    getSocket ( host, port ) {}
}

module.exports = function proxy ( url ) {
    url = new URL( url );

    return new Proxy( url.hostname, url.port, url.username, url.password );
};
