export default class AclUser {
    #id;
    #aclId;
    #aclType;
    #aclTypeId;
    #enabled;
    #roles;
    #rolesSet;
    #permissions;
    #permissionsSet;
    #cacheId;

    constructor ( { id, aclId, aclType, aclTypeId, enabled, roles, permissions } ) {
        this.#id = id;
        this.#aclId = aclId;
        this.#aclType = aclType;
        this.#aclTypeId = aclTypeId;
        this.#enabled = enabled;
        this.#roles = roles;
        this.#rolesSet = new Set( roles );
        this.#permissions = permissions;
        this.#permissionsSet = new Set( permissions );
    }

    // properties
    get id () {
        return this.#id;
    }

    get aclId () {
        return this.#aclId;
    }

    get aclType () {
        return this.#aclType;
    }

    get aclTypeId () {
        return this.#aclTypeId;
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
        return ( this.#cacheId ??= this.#aclId + "/" + this.#id );
    }

    // public
    hasRole ( role ) {
        return this.#rolesSet.has( role );
    }

    hasPermission ( permission ) {
        return this.#permissionsSet.has( permission );
    }
}
