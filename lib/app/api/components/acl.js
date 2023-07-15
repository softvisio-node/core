import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import { isKebabCase, isKebabCasePath } from "#lib/utils/naming-conventions";
import Mutex from "#lib/threads/mutex";
import constants from "#lib/app/constants";
import GlobPatterns from "#lib/glob/patterns";

const STATIC_PERMISSIONS = new Set( ["guests", "users", "root"] ),
    SUGGEST_ACL_USERS_LIMIT = 20;

const SQL = {
    "getAclType": sql`SELECT acl_type.type FROM acl_type, acl WHERE acl.acl_type_id = acl_type.id AND acl.id = ?`.prepare(),

    "addAclUser": sql`INSERT INTO acl_user ( acl_id, user_id, enabled ) VALUES ( ?, ?, ? ) ON CONFLICT ( acl_id, user_id ) DO NOTHING`.prepare(),

    "getAclUser": sql`
SELECT
    acl_type.type,
    acl_user.created,
    acl_user.enabled,
    acl_user_roles( acl_user.acl_id, acl_user.user_id ),
    acl_user_permissions( acl_user.acl_id, acl_user.user_id )
FROM
    acl_user,
    acl,
    acl_type
WHERE
    acl_user.acl_id = ?
    AND acl_user.user_id = ?
    AND acl.id = acl_user.acl_id
    AND acl_type.id = acl.acl_type_id
`.prepare(),

    "deleteAclUser": sql`DELETE FROM acl_user WHERE acl_id = ? AND user_id = ?`.prepare(),

    "setAclUserEnabled": sql`UPDATE acl_user SET enabled = ? WHERE acl_id = ? AND user_id = ?`.prepare(),

    "suggestAclUsers": sql`
SELECT
    id,
    email,
    'https://s.gravatar.com/avatar/' || "user".gravatar || ? AS avatar
FROM
    "user"
WHERE
    "user".email ILIKE ? ESCAPE '\\'
    AND "user".id != ?
    AND "user".id NOT IN ( SELECT user_id FROM acl_user WHERE acl_id = ? )
LIMIT
    ?
`,
};

export default class extends Component {
    #rolePermissions = {};
    #resolvers = {};
    #mutexSet = new Mutex.Set();
    #aclIdCache;
    #aclObjectIdCache;
    #aclUserUserCache;
    #aclTypeRolesCache = {};

    // properties
    get staticPermissions () {
        return STATIC_PERMISSIONS;
    }

    get types () {
        return this.app.acl.types;
    }

    // public
    async checkAclPermission ( userId, permission, aclResolvers ) {
        if ( this.app.userIsRoot( userId ) ) return true;

        const aclIds = new Set();

        // resolve acl
        if ( aclResolvers ) {
            for ( const aclResolver of aclResolvers ) {
                const aclId = await this.#resolveAclId( aclResolver.id, aclResolver.resolver );

                // acl not resolved
                if ( !aclId ) return false;

                aclIds.add( aclId );
            }
        }

        // default acl
        else {
            aclIds.add( constants.defaultAclId );
        }

        for ( const aclId of aclIds ) {
            const user = await this.#getAclUser( aclId, userId );

            // acl user not found of disabled
            if ( !user || !user.enabled ) return false;

            // acl user has no permissions
            if ( !user.permissions.has( permission ) ) return false;
        }

        return true;
    }

    async suggestAclUsers ( aclId, query ) {
        query = query ? `%${sql.quoteLikePattern( query )}%` : "%";

        return this.dbh.select( SQL.suggestAclUsers, [

            //
            "?d=" + this.app.users.config.defaultGravatarEncoded,
            query,
            constants.rootUserId,
            aclId,
            SUGGEST_ACL_USERS_LIMIT,
        ] );
    }

    async addAclUser ( aclId, userId, { enabled = true, roles, parentUserId, dbh } = {} ) {
        var res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        // check parent user
        if ( parentUserId && !this.app.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        res = await dbh.begin( async dbh => {
            var res;

            res = await dbh.do( SQL.addAclUser, [aclId, userId, enabled] );

            if ( !res.ok ) throw res;

            if ( !res.meta.rows ) throw `Unable to add user`;

            if ( roles ) {
                res = await this.#setAclUserRoles( aclId, userId, roles, { parentUserId, dbh } );

                if ( !res.ok ) throw res;
            }
        } );

        return res;
    }

    async deleteAclUser ( aclId, userId, { parentUserId, dbh } = {} ) {
        var res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        // check parent user
        if ( parentUserId && !this.app.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        res = await dbh.do( SQL.deleteAclUser, [aclId, userId] );

        if ( res.meta.rows ) {

            // drop cache
            const cacheId = aclId + "/" + userId;
            this.#aclUserUserCache.delete( cacheId );
        }

        return res;
    }

    async setAclUserEnabled ( aclId, userId, enabled, { parentUserId, dbh } = {} ) {
        var res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        // check parent user
        if ( parentUserId && !this.app.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        res = await dbh.do( SQL.setAclUserEnabled, [enabled, aclId, userId] );

        if ( res.meta.rows ) {

            // drop cache
            const cacheId = aclId + "/" + userId;
            if ( this.#aclUserUserCache.has( cacheId ) ) this.#aclUserUserCache.get( cacheId ).enabled = enabled;
        }

        return res;
    }

    async setAclUserRoles ( aclId, userId, roles, { parentUserId, dbh } = {} ) {
        const res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        const user = await this.#getAclUser( aclId, userId, { dbh } );

        if ( user === false ) {
            return result( [400, `Unable to add ACL user roles`] );
        }
        else if ( !user ) {
            return this.addAclUser( aclId, userId, { roles, parentUserId, dbh } );
        }
        else {
            return this.#setAclUserRoles( aclId, userId, roles, { parentUserId, dbh } );
        }
    }

    async addAclUserRoles ( aclId, userId, roles, { parentUserId, dbh } = {} ) {
        var res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        const user = await this.#getAclUser( aclId, userId, { dbh } );

        if ( user === false ) {
            return result( [400, `Unable to add ACL user roles`] );
        }
        else if ( !user ) {
            return this.addAclUser( aclId, userId, { roles, parentUserId, dbh } );
        }

        const aclType = user.aclType;

        // check parent user
        if ( parentUserId && !this.app.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        if ( !roles ) {
            roles = [];
        }
        else if ( !Array.isArray( roles ) ) {
            roles = [roles];
        }

        roles = new Set( roles );

        const addRoles = [];

        for ( const role of roles ) {
            if ( !this.types[aclType].roles[role] ) return result( [400, `ACL roles are invalid`] );

            if ( parentUser && !parentUser.roles.has( role ) ) return result( [400, `ACL roles are invalid`] );

            if ( !user.roles.has( role ) ) addRoles.push( role );
        }

        if ( !addRoles.length ) return result( 200 );

        res = await dbh.do( sql`INSERT INTO acl_user_role`.VALUES( addRoles.map( role => {
            return {
                "acl_id": aclId,
                "user_id": userId,
                "acl_role_id": sql`SELECT acl_role.id FROM acl_role, acl_type WHERE acl_role.acl_type_id = acl_type.id AND acl_type.type = ${aclType} AND acl_role.role = ${role}`,
            };
        } ) ) );

        return res;
    }

    async deleteAclUserRoles ( aclId, userId, roles, { parentUserId, dbh } = {} ) {
        var res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        const user = await this.#getAclUser( aclId, userId, { dbh } );

        if ( !user ) {
            return result( [400, `Unable to delete ACL user roles`] );
        }

        const aclType = user.aclType;

        // check parent user
        if ( parentUserId && !this.app.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        if ( !roles ) {
            roles = [];
        }
        else if ( !Array.isArray( roles ) ) {
            roles = [roles];
        }

        roles = new Set( roles );

        const deleteRoles = [];

        for ( const role of roles ) {
            if ( !this.types[aclType].roles[role] ) return result( [400, `ACL roles are invalid`] );

            if ( parentUser && !parentUser.roles.has( role ) ) return result( [400, `ACL roles are invalid`] );

            if ( user.roles.has( role ) ) deleteRoles.push( role );
        }

        if ( !deleteRoles.length ) return result( 200 );

        res = await dbh.do( sql`
DELETE FROM
    acl_user_role
WHERE
    acl_id = ${aclId}
    AND user_id = ${userId}
    AND acl_role_id IN (
        SELECT
            acl_role.id
        FROM
            acl_role,
            acl_type
        WHERE
            acl_role.acl_type_id = acl_type.id
            AND acl_type.type = ${aclType}
            AND acl_role.role`.IN( deleteRoles ).sql`
    )
` );

        return res;
    }

    async getAclUserRoles ( aclId, userId, { parentUserId } = {} ) {
        const userIsRoot = this.app.userIsRoot( userId );

        var user, parentUser;

        // get parent user
        if ( parentUserId && !this.app.userIsRoot( parentUserId ) ) {
            parentUser = await this.#getAclUser( aclId, parentUserId );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get ACL roles`] );
        }

        // get user
        if ( userId && !userIsRoot ) {
            user = await this.#getAclUser( aclId, userId );

            if ( user === false ) return result( [400, `Unable to get ACL roles`] );
        }

        // get acl type
        const aclType = user?.aclType || parentUser?.aclType || ( await this.#getAclType( aclId ) );
        if ( !aclType ) return result( [400, `ACL id is invalid`] );

        const roles = [];

        for ( const role of Object.values( this.types[aclType].roles ) ) {
            let readonly;

            if ( userIsRoot ) {
                readonly = true;
            }
            else if ( userId === parentUserId ) {
                readonly = true;
            }
            else if ( parentUser ) {
                readonly = !parentUser.roles.has( role.role );
            }
            else {
                readonly = false;
            }

            roles.push( {
                "id": role.role,
                "name": role.name,
                "description": role.description,
                "enabled": userIsRoot ? true : user ? user.roles.has( role.role ) : false,
                readonly,
            } );
        }

        return result( 200, roles );
    }

    async getAclUserPermissions ( aclId, userId ) {
        if ( this.app.userIsRoot( userId ) ) {
            const aclType = await this.#getAclType( aclId );

            if ( aclType === false ) {
                return false;
            }
            else if ( !aclType ) {
                return null;
            }
            else {
                const permissions = [];

                for ( const role of Object.values( this.types[aclType].roles ) ) {
                    permissions.push( ...role.permissions );
                }

                return [...new Set( permissions )];
            }
        }
        else {
            const user = await this.#getAclUser( aclId, userId );

            if ( user === false ) {
                return false;
            }
            else if ( !user ) {
                return null;
            }
            else {
                return user.rawPermissions;
            }
        }
    }

    async getAclRoles ( aclId ) {
        const aclType = await this.#getAclType( aclId );

        if ( !aclType ) return result( [400, `ACL id is invalid`] );

        var data = this.#aclTypeRolesCache[aclType];

        if ( !data ) {
            data = [];

            for ( const role of Object.values( this.types[aclType].roles ) ) {
                data.push( {
                    "id": role.role,
                    "name": role.name,
                    "description": role.description,
                } );
            }

            this.#aclTypeRolesCache[aclType] = data;
        }

        return result( 200, data );
    }

    // protected
    async _init () {
        const res = await this.#configureAcl();
        if ( !res.ok ) return res;

        this.#aclIdCache = new CacheLru( { "maxSize": this.app.acl.config.cacheMaxSize } );
        this.#aclUserUserCache = new CacheLru( { "maxSize": this.app.acl.config.cacheMaxSize } );
        this.#aclObjectIdCache = new CacheLru( { "maxSize": this.app.acl.config.cacheMaxSize } );

        // setup dbh events
        this.dbh.on( "acl/update", data => {
            const cacheId = data.acl_id + "/" + data.user_id;

            if ( this.#aclUserUserCache.has( cacheId ) ) {
                this.#aclUserUserCache.get( cacheId ).enabled = data.enabled;
            }
        } );

        this.dbh.on( "acl/delete", data => {
            const cacheId = data.acl_id + "/" + data.user_id;

            this.#aclUserUserCache.delete( cacheId );
        } );

        this.dbh.on( "disconnect", () => this.#aclUserUserCache.clear() );

        return result( 200 );
    }

    // private
    // XXX store roles permissions
    async #configureAcl () {
        const types = {};

        for ( const component of this.app.components ) {
            const acl = await component.getAcl();

            if ( !acl ) continue;

            for ( const [type, roles] of Object.entries( acl ) ) {
                if ( types[type] ) {
                    return result( [400, `ACL "${type}" is already defined`] );
                }

                types[type] = {
                    type,
                    "roles": {},
                };

                for ( const [role, roleSpec] of Object.entries( roles ) ) {
                    types[type].roles[role] = {
                        role,
                        ...roleSpec,
                    };
                }
            }
        }

        const allPermissions = new Set(),
            unusedPermissions = new Set();

        // check api schema permissions, create permissions index
        {
            for ( const method of Object.values( this.api.schema.methods ) ) {
                if ( !method.permission ) continue;

                // static permission
                if ( STATIC_PERMISSIONS.has( method.permission ) ) continue;

                // validate permission name
                const [namespace, name] = method.permission.split( ":" );
                if ( !isKebabCasePath( namespace, { "absolute": false, "folder": false } ) || !isKebabCase( name ) ) return result( [500, `Permission "${method.permission}" is invalid`] );

                allPermissions.add( method.permission );
                unusedPermissions.add( method.permission );
            }
        }

        // acl types
        {
            for ( const [aclType, typeSpec] of Object.entries( types ) ) {
                const roles = typeSpec.roles;

                // roles
                for ( const [role, roleSpec] of Object.entries( roles ) ) {
                    const resolvedPermissions = new Set(),
                        globPatterns = new GlobPatterns();

                    // resolve permissions masks, namespace/*, namespace:*
                    for ( const permission of roleSpec.permissions ) {
                        globPatterns.add( permission );

                        let match;

                        for ( const schemaPermission of allPermissions ) {
                            if ( globPatterns.match( schemaPermission ) ) {
                                match = true;

                                resolvedPermissions.add( schemaPermission );
                            }
                        }

                        // permission mask not resolved, error will be thrown later
                        if ( !match ) resolvedPermissions.add( permission );

                        globPatterns.clear();
                    }

                    this.#rolePermissions[aclType] ??= {};
                    this.#rolePermissions[aclType][role] = [...resolvedPermissions];

                    // check obsolete permissions
                    for ( const permission of this.#rolePermissions[aclType][role] ) {

                        // role has unknown permission
                        if ( !allPermissions.has( permission ) ) {
                            return result( [500, `ACL type "${aclType}", role "${role}", permission "${permission}" is not used by any API method`] );
                        }

                        unusedPermissions.delete( permission );
                    }
                }
            }

            // has unused permissions
            if ( unusedPermissions.size ) {
                return result( [500, `Following permissions are not used by any ACL, access to the API methods will be disabled: ${[...unusedPermissions].join( ", " )}`] );
            }
        }

        // acl resolvers
        {
            for ( const [aclResolver, query] of Object.entries( this.api.schema.aclResolvers ) ) {
                this.#resolvers[aclResolver] = query ? sql( query ).prepare() : null;
            }
        }

        // check api methods acl object types
        {
            for ( const method of Object.values( this.api.schema.methods ) ) {
                if ( !method.aclResolvers ) continue;

                for ( const aclResolver of method.aclResolvers ) {
                    if ( !( aclResolver in this.#resolvers ) ) {
                        return result( [500, `ACL object type "${aclResolver}" is not registered`] );
                    }
                }
            }
        }

        return result( 200 );
    }

    async #resolveAclId ( aclObjectId, aclResolver ) {
        const resolver = this.#resolvers[aclResolver];

        if ( !resolver ) return aclObjectId;

        const cacheId = `${aclResolver}/${aclObjectId}`;

        var aclId = this.#aclObjectIdCache.get( cacheId );

        if ( aclId ) return aclId;

        const mutex = this.#mutexSet.get( `resolve/${cacheId}` );
        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this.dbh.selectRow( resolver, [aclObjectId] );

        if ( !res.ok ) {
            aclId = false;
        }
        else if ( res.data ) {
            aclId = res.data.id;

            this.#aclObjectIdCache.set( cacheId, aclId );
        }
        else {
            aclId = null;
        }

        mutex.unlock( aclId );

        return aclId;
    }

    async #getAclType ( aclId, { dbh } = {} ) {
        var aclType = this.#aclIdCache.get( aclId );

        if ( aclType ) return aclType;

        const mutex = this.#mutexSet.get( `type/${aclId}` );
        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getAclType, [aclId] );

        if ( !res.ok ) {
            aclType = false;
        }
        else if ( res.data ) {
            aclType = res.data.type;

            if ( this.types[aclType] ) {
                this.#aclIdCache.set( aclId, aclType );
            }
        }
        else {
            aclType = null;
        }

        mutex.unlock( aclType );

        return aclType;
    }

    async #getAclUser ( aclId, userId, { dbh } = {} ) {
        const cacheId = aclId + "/" + userId;

        var user = this.#aclUserUserCache.get( cacheId );

        if ( user ) return user;

        const mutex = this.#mutexSet.get( `user/${cacheId}` );
        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getAclUser, [aclId, userId] );

        if ( !res.ok ) {
            user = false;
        }
        else if ( res.data ) {
            user = {
                "id": userId,
                cacheId,
                aclId,
                "aclType": res.data.type,
                "created": res.data.created,
                "enabled": res.data.enabled,
                "roles": new Set( res.data.acl_user_roles ),
                "permissions": new Set( res.data.acl_user_permissions ),
                "rawPermissions": res.data.acl_user_permissions,
            };

            this.#aclUserUserCache.set( cacheId, user );
        }
        else {
            user = null;
        }

        mutex.unlock( user );

        return user;
    }

    async #setAclUserRoles ( aclId, userId, roles, { parentUserId, dbh } = {} ) {
        var res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        const user = await this.#getAclUser( aclId, userId, { dbh } );

        if ( !user ) {
            return result( [400, `Unable to delete ACL user roles`] );
        }

        const aclType = user.aclType;

        // check parent user
        if ( parentUserId && !this.app.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        if ( !roles ) {
            roles = [];
        }
        else if ( !Array.isArray( roles ) ) {
            roles = [roles];
        }

        roles = new Set( roles );

        const addRoles = [],
            deleteRoles = [];

        for ( const role of roles ) {
            if ( !this.types[aclType].roles[role] ) return result( [400, `ACL roles are invalid`] );

            if ( parentUser && !parentUser.roles.has( role ) ) return result( [400, `ACL roles are invalid`] );

            if ( !user.roles.has( role ) ) addRoles.push( role );
        }

        for ( const role of user.roles ) {
            if ( parentUser && !parentUser.roles.has( role ) ) return result( [400, `ACL roles are invalid`] );

            if ( !roles.has( role ) ) deleteRoles.push( role );
        }

        if ( !addRoles.length && !deleteRoles.length ) return result( 200 );

        res = await dbh.begin( async dbh => {
            var res;

            if ( addRoles.length ) {
                res = await dbh.do( sql`INSERT INTO acl_user_role`.VALUES( addRoles.map( role => {
                    return {
                        "acl_id": aclId,
                        "user_id": userId,
                        "acl_role_id": sql`SELECT acl_role.id FROM acl_role, acl_type WHERE acl_role.acl_type_id = acl_type.id AND acl_type.type = ${aclType} AND acl_role.role = ${role}`,
                    };
                } ) ) );

                if ( !res.ok ) throw res;
            }

            if ( deleteRoles.length ) {
                res = await dbh.do( sql`
DELETE FROM
    acl_user_role
WHERE
    acl_id = ${aclId}
    AND user_id = ${userId}
    AND acl_role_id IN (
        SELECT
            acl_role.id
        FROM
            acl_role,
            acl_type
        WHERE
            acl_role.acl_type_id = acl_type.id
            AND acl_type.type = ${aclType}
            AND acl_role.role`.IN( deleteRoles ).sql`
    )
` );

                if ( !res.ok ) throw res;
            }
        } );

        return res;
    }

    #validateUser ( userId, parentUserId ) {
        if ( this.app.userIsRoot( userId ) ) return result( [400, `Unable to add root user`] );

        if ( userId === parentUserId ) return result( [400, `Unable to add user`] );

        return result( 200 );
    }
}
