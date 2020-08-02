const IS_PROXY = Symbol();

class SuperProxy {
    static [IS_PROXY] = true;

    #host;
    #port;
    #username;
    #password;

    static isProxy () {
        return this[IS_PROXY];
    }

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

    get username () {
        return this.#username;
    }

    get password () {
        return this.#password;
    }
}

module.exports = SuperProxy;
