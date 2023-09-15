export default class AclUser {
    #aclId;
    #userId;
    #aclType;
    #enabled;
    #roles;
    #rolesSet;
    #permissions;
    #permissionsSet;
    #cacheId;

    constructor ( { aclId, userId, aclType, enabled, roles, permissions } ) {
        this.#aclId = aclId;
        this.#userId = userId;
        this.#aclType = aclType;
        this.#enabled = enabled;
        this.#roles = roles;
        this.#rolesSet = new Set( roles );
        this.#permissions = permissions;
        this.#permissionsSet = new Set( permissions );
    }

    // properties
    get aclId () {
        return this.#aclId;
    }

    get userId () {
        return this.#userId;
    }

    get aclType () {
        return this.#aclType;
    }

    get enabled () {
        return this.#enabled;
    }

    get roles () {
        return this.#roles;
    }

    get permissions () {
        return this.#permissions;
    }

    get cacheId () {
        return ( this.#cacheId ??= this.#aclId + "/" + this.#userId );
    }

    // public
    hasRole ( role ) {
        return this.#rolesSet.has( role );
    }

    hasPermission ( permission ) {
        return this.#permissionsSet.has( permission );
    }
}
