export class DockerService {
    #id;
    #name;
    #hostname;

    constructor ( config ) {
        this.#id = config.ID;
        this.#name = config.Spec.Name;
        this.#hostname = "tasks." + config.Spec.Name;
    }

    // properties
    get id () {
        return this.#id;
    }

    get name () {
        return this.#name;
    }

    get hostname () {
        return this.#hostname;
    }
}
