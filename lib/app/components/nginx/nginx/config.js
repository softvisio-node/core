export default class NginxConfig {
    #nginx;

    constructor ( nginx ) {
        this.#nginx = nginx;
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    // public
    addServer ( server ) {}
}
