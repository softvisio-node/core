import Permissions from "#lib/app/user/permissions";

export default class AclUser {
    #id;
    #aclId;
    #aclType;
    #aclTypeId;
    #enabled;
    #roles;
    #rolesSet;
    #permissions;

    constructor ( { id, aclId, aclType, aclTypeId, enabled, roles, permissions } ) {
        this.#id = id;
        this.#aclId = aclId;
        this.#aclType = aclType;
        this.#aclTypeId = aclTypeId;
        this.#enabled = enabled;
        this.#roles = roles;
        this.#rolesSet = new Set( roles );
        this.#permissions = new Permissions( this.#id, permissions );
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

    get isEnabled () {
        return this.#enabled;
    }

    get roles () {
        return this.#roles;
    }

    get permissions () {
        return this.#permissions;
    }

    // public
    updateFields ( fields ) {
        if ( "enabled" in fields ) this.#enabled = fields.enabled;
    }

    hasRoles ( role ) {
        return this.#rolesSet.has( role );
    }
}
