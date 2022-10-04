export default class {
    #module;
    #name;
    #id;

    #title;
    #description;
    #deprecated = false;
    #private = false;
    #roles;
    #authorizationRequired = false;
    #persistentConnectionRequired = false;
    #logApiCalls = false;
    #activeRequestsLimit = 0;
    #activeRequestsUserLimit = 0;

    constructor ( module, name ) {
        this.#module = module;
        this.#name = name;
        this.#id = `${module.id}/${name}`;
    }

    // properties
    get module () {
        return this.#module;
    }

    get name () {
        return this.#name;
    }

    get id () {
        return this.#id;
    }

    get title () {
        return this.#title;
    }

    get description () {
        return this.#description;
    }

    get deprecated () {
        return this.#deprecated;
    }

    get private () {
        return this.#private;
    }

    get roles () {
        return this.#roles || this.#module.roles;
    }

    get authorizationRequired () {
        return this.#authorizationRequired;
    }

    get persistentConnectionRequired () {
        return this.#persistentConnectionRequired;
    }

    get logApiCalls () {
        return this.#logApiCalls;
    }

    get activeRequestsLimit () {
        return this.#activeRequestsLimit;
    }

    get activeRequestsUserLimit () {
        return this.#activeRequestsUserLimit;
    }

    get object () {
        return this.#module.object;
    }

    // public
    setSpec ( spec ) {
        if ( spec.title ) this.#title = spec.title;
        if ( spec.description ) this.#description = spec.description;
        if ( spec.deprecated != null ) this.#deprecated = spec.deprecated;
        if ( spec.private != null ) this.#private = spec.private;
        if ( spec.roles ) this.#roles = new Set( spec.roles );
        if ( spec.authorizationRequired != null ) this.#authorizationRequired = spec.authorizationRequired;
        if ( spec.persistentConnectionRequired != null ) this.#persistentConnectionRequired = spec.persistentConnectionRequired;
        if ( spec.logApiCalls != null ) this.#logApiCalls = spec.logApiCalls;
        if ( spec.activeRequestsLimit != null ) this.#activeRequestsLimit = spec.activeRequestsLimit;
        if ( spec.activeRequestsUserLimit != null ) this.#activeRequestsUserLimit = spec.activeRequestsUserLimit;
    }
}
