import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import { isKebabCase, isKebabCasePath } from "#lib/utils/naming-conventions";
import Mutex from "#lib/threads/mutex";

const DEFAULT_ACL_TYPE = "default",
    DEFAULT_ACL_ID = -1,
    ACL_OBJECT_TYPE = "acl";

const QUERIES = {
    "getAclType": sql`SELECT acl_type.type FROM acl_type, acl WHERE acl.acl_type_id = acl_type.id AND acl.id = ?`.prepare(),

    "getAclUser": sql`
SELECT
    enabled,
    (
        SELECT
            json_agg( acl_role.role )
        FROM
            acl_role,
            acl_user_role
        WHERE
            acl_user_role.acl_id = acl_user.acl_id
            AND acl_user_role.user_id = acl_user.user_id
            AND acl_user_role.acl_role_id = acl_role.id
    ) AS roles
FROM
    acl_user
WHERE
    acl_id = ?
    AND user_id = ?
`.prepare(),

    "upsertUser": sql`
INSERT INTO acl_user ( acl_id, user_id, enabled ) VALUES ( ?, ?, ? )
ON CONFLICT ( acl_id, user_id  ) DO UPDATE SET enabled = EXCLUDED.enabled
`.prepare(),

    "deleteUser": sql`DELETE FROM acl_user WHERE acl_id = ? AND user_id = ?`.prepare(),

    "getAclPermissions": sql`SELECT acl_permissions( ?, ?, ? )`.prepare(),

    "setUserEnabled": sql`UPDATE acl_user SET enabled = ? WHERE acl_id = ? AND user_id = ?`.prepare(),

    "getUsers": sql`
SELECT
    acl_user.user_id AS id,
    "user".email AS email,
    acl_user.enabled AS enabled,
    (
        SELECT
            json_agg( acl_role.role )
        FROM
            acl_role,
            acl_user_role
        WHERE
            acl_user_role.acl_id = acl_user.acl_id
            AND acl_user_role.user_id = acl_user.user_id
            AND acl_user_role.acl_role_id = acl_role.id
    ) AS roles,
    acl_permissions( acl_user.acl_id, ?, 'acl' ) AS editor_acl_permissions,
    'https://s.gravatar.com/avatar/' || "user".gravatar || ? AS avatar
FROM
    acl_user,
    "user"
WHERE
    acl_user.acl_id = ?
    AND acl_user.user_id = "user".id
`.prepare(),

    "insertRole": sql`
INSERT INTO acl_user_role (
    acl_id,
    user_id,
    acl_role_id
) VALUES (
    ?,
    ?,
    ( SELECT acl_role.id FROM acl_role, acl_type WHERE acl_role.acl_type_id = acl_type.id AND acl_type.type = ? AND acl_role.role = ? )
) ON CONFLICT ( acl_id, user_id, acl_role_id ) DO NOTHING
`.prepare(),

    "deleteRole": sql`
DELETE FROM
    acl_user_role
WHERE
    acl_id = ?
    AND user_id = ?
    AND acl_role_id = ( SELECT acl_role.id FROM acl_role, acl_type WHERE acl_role.acl_type_id = acl_type.id AND acl_type.type = ? AND acl_role.role = ? )
`.prepare(),
};

export default class extends Component {
    #types = {};
    #objectTypes = {
        [ACL_OBJECT_TYPE]: null,
    };
    #mutexSet = new Mutex.Set( { "destroyOnFinish": true } );
    #aclIdCache;
    #aclObjectIdCache;
    #aclUserUserCache;

    // public
    async checkAclPermissions ( userId, method, { aclObjectId, aclObjectType } = {} ) {
        if ( this.api.validate.userIsRoot( userId ) ) return true;

        var aclId;

        // resolve object id
        if ( aclObjectId ) {
            aclId = await this.#resolveAclId( aclObjectId, aclObjectType );
        }

        // default acl
        else {
            aclId = DEFAULT_ACL_ID;
        }

        if ( !aclId ) return false;

        const aclType = await this.#getAclType( aclId );
        if ( !aclType ) return false;
        const typeSpec = this.#types[aclType];

        const user = await this.#getAclUser( aclId, userId );
        if ( !user || !user.enabled ) return false;

        // check roles permissions
        for ( const role of user.roles ) {
            const roleSpec = typeSpec.roles[role];

            if ( !roleSpec ) continue;

            if ( roleSpec.permissions[method.id] ) return true;
        }

        return false;
    }

    async setAclUserRoles ( aclId, userId, { dbh, editorUserId, enabled, roles = [] } = {} ) {
        if ( this.api.validate.userIsRoot( userId ) ) return result( [400, `Unable to set roles`] );

        dbh ||= this.dbh;

        const aclType = await this.#getAclType( aclId, { dbh } );
        if ( !aclType ) return result( [400, `ACL type is invalid`] );

        var parentUser;

        if ( editorUserId && !this.api.validate.userIsRoot( editorUserId ) ) {
            parentUser = await this.#getAclUser( aclId, editorUserId, { dbh } );

            if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to set user roles`] );
        }

        roles = new Set( roles );

        // validate roles
        for ( const role of roles ) {
            if ( !this.#types[aclType].roles[role] ) return result( [400, `Role is invalid`] );

            if ( parentUser && !parentUser.roles.has( role ) ) return result( [400, `Unable to set roles`] );
        }

        const res = await dbh.begin( async dbh => {
            var res = await dbh.do( QUERIES.upsertUser, [aclId, userId, enabled] );
            if ( !res.ok ) throw res;

            if ( roles.size ) {
                const values = [];

                for ( const role of roles ) {
                    values.push( {
                        "acl_id": aclId,
                        "user_id": userId,
                        "acl_role_id": sql`SELECT acl_role.id FROM acl_role, acl_type WHERE acl_role.acl_type_id = acl_type.id AND acl_type.type = ${aclType} AND acl_role.role = ${role}`,
                    } );
                }

                res = await dbh.do( sql`INSERT INTO acl_user_role`.VALUES( values ) );
                if ( !res.ok ) throw res;
            }
        } );

        if ( !res.ok ) return res;

        // drop cache
        const cacheId = aclId + "/" + userId;
        this.#aclUserUserCache.delete( cacheId );

        return res;
    }

    async deleteAclUser ( aclId, userId, { dbh, editorUserId } = {} ) {

        // check parent user
        if ( editorUserId && !this.api.validate.userIsRoot( editorUserId ) ) {
            const parentUser = await this.#getAclUser( aclId, editorUserId, { dbh } );

            if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to delete user`] );
        }

        dbh ||= this.dbh;

        const res = await dbh.do( QUERIES.deleteUser, [aclId, userId] );

        if ( res.meta.rows ) {

            // drop cache
            const cacheId = aclId + "/" + userId;
            this.#aclUserUserCache.delete( cacheId );
        }

        return res;
    }

    async setAclUserEnabled ( aclId, userId, enabled, { dbh, editorUserId } = {} ) {

        // check parent user
        if ( editorUserId && !this.api.validate.userIsRoot( editorUserId ) ) {
            const parentUser = await this.#getAclUser( aclId, editorUserId, { dbh } );

            if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to delete user`] );
        }

        dbh ||= this.dbh;

        const res = await dbh.do( QUERIES.setUserEnabled, [enabled, aclId, userId] );

        if ( res.meta.rows ) {

            // drop cache
            const cacheId = aclId + "/" + userId;
            if ( this.#aclUserUserCache.has( cacheId ) ) this.#aclUserUserCache.get( cacheId ).enabled = enabled;
        }

        return res;
    }

    async setAclUserRoleEnabled ( aclId, userId, role, enabled, { dbh, editorUserId } = {} ) {
        dbh ||= this.dbh;

        // get object type
        const aclType = await this.#getAclType( aclId, { dbh } );
        if ( !aclType ) return result( [400, `Object type is invalid`] );

        // validate role
        if ( !this.#types[aclType].roles[role] ) return result( [400, `Role is invalid`] );

        // get user
        const user = await this.#getAclUser( aclId, userId, { dbh } );
        if ( !user ) return result( 500 );

        // check parent user roles
        if ( editorUserId && !this.api.validate.userIsRoot( editorUserId ) ) {
            const parentUser = await this.#getAclUser( aclId, editorUserId, { dbh } );

            if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to set role`] );

            if ( !parentUser.roles.has( role ) ) return result( [400, `Unable to set role`] );
        }

        var res;

        if ( enabled ) {
            res = await this.dbh.do( QUERIES.insertRole, [aclId, userId, aclType, role] );
        }
        else {
            res = await this.dbh.do( QUERIES.deleteRole, [aclId, userId, aclType, role] );
        }

        if ( !res.ok ) return res;

        // update cache
        const cacheId = aclId + "/" + userId;
        if ( this.#aclUserUserCache.has( cacheId ) ) {
            if ( enabled ) {
                this.#aclUserUserCache.get( cacheId ).roles.add( role );
            }
            else {
                this.#aclUserUserCache.get( cacheId ).roles.delete( role );
            }
        }

        return res;
    }

    async getAclPermissions ( aclId, userId, aclObjectType ) {
        return this.dbh.selectRow( QUERIES.getAclPermissions, [aclId, userId, aclObjectType] );
    }

    async getAclRoles ( aclId, { editorUserId } = {} ) {
        const aclType = await this.#getAclType( aclId );
        if ( !aclType ) return result( [400, `ACL type is invalid`] );

        var parentUserRoles;

        // check parent user roles
        if ( editorUserId && !this.api.validate.userIsRoot( editorUserId ) ) {
            const parentUser = await this.#getAclUser( aclId, editorUserId );

            if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to get roles`] );

            parentUserRoles = parentUser.roles;
        }

        const roles = [];

        for ( const roleId of Object.keys( this.#types[aclType].roles ).sort() ) {
            const role = this.#types[aclType].roles[roleId];

            roles.push( {
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "readonly": parentUserRoles ? !parentUserRoles.has( role.id ) : false,
            } );
        }

        return result( 200, roles );
    }

    async getAclUsers ( aclId, { editorUserId } = {} ) {
        const aclType = await this.#getAclType( aclId );
        if ( !aclType ) return result( [400, `ACL id is invalid`] );

        const res = await this.dbh.select( QUERIES.getUsers, [

            //
            editorUserId || -1,
            "?d=" + this.api.config.defaultGravatarEncoded,
            aclId,
        ] );

        if ( res.data ) {
            const roles = await this.getAclRoles( aclId, { editorUserId } );
            if ( !roles.ok ) return roles;

            for ( const row of res.data ) {
                row.readonly = editorUserId ? row.id === editorUserId : false;

                const userRoles = [],
                    rowRoles = new Set( row.roles );

                for ( const role of roles.data ) {
                    userRoles.push( {
                        ...role,
                        "enabled": rowRoles.has( role.id ),
                        "readonly": editorUserId && editorUserId === row.id ? true : role.readonly,
                    } );
                }

                row.roles = userRoles;
            }
        }

        return res;
    }

    // protected
    async _init () {
        this.#aclIdCache = new CacheLru( { "maxSize": this.api.config.aclCacheMaxSize } );
        this.#aclUserUserCache = new CacheLru( { "maxSize": this.api.config.aclCacheMaxSize } );
        this.#aclObjectIdCache = new CacheLru( { "maxSize": this.api.config.aclCacheMaxSize } );

        return result( 200 );
    }

    // XXX
    async _postInit ( acl ) {
        if ( !this.api.config.acl ) return result( 200 );

        // default ACL is required
        if ( !this.api.config.acl.types[DEFAULT_ACL_TYPE] ) {
            return result( [400, `Default ACL is required`] );
        }

        const allPermissions = new Set(),
            unusedPermissions = new Set();

        // check api schema permissions, create permissions index
        {
            for ( const method of Object.values( this.api.frontend.schema.methods ) ) {
                if ( !method.permission ) continue;

                // validate permission name
                const [namespace, name] = method.permission.split( ":" );
                if ( !isKebabCasePath( namespace ) || !isKebabCasePath( name ) ) return result( [500, `Permission "${method.permission}" is invalid`] );

                allPermissions.add( method.permission );
                unusedPermissions.add( method.permission );
            }
        }

        // types
        {
            for ( const [aclType, scopes] of Object.entries( this.api.config.acl.types ) ) {

                // type id must be in kebab-case
                if ( !isKebabCase( aclType ) ) return result( [500, `ACL type "${aclType}" must be in the kebab-case`] );

                // ACL type is already registered
                if ( this.#types[aclType] ) return result( [500, `ACL type "${aclType}" is already registered`] );

                // roles
                for ( const [scope, scopeSpec] of Object.entries( scopes ) ) {

                    // role id must be in kebab-case
                    if ( !isKebabCase( scope ) ) return result( [500, `ACL scope "${scope}" must be in the kebab-case`] );

                    scopeSpec.scope = scope;

                    // check obsolete permissions
                    for ( const permission of scopeSpec.permissions ) {

                        // role has unknown permission
                        if ( !allPermissions.has( permission ) ) {
                            return result( [500, `ACL type "${aclType}", scope "${scope}", permission "${permission}" is not used by any API method`] );
                        }

                        unusedPermissions.delete( permission );
                    }
                }

                // register ACL type
                this.#types[aclType] = {
                    "type": aclType,
                    scopes,
                };
            }

            // has unused permissions
            if ( unusedPermissions.size ) {
                return result( [500, `Following permissions are not used by any ACL, access to the API methods will be disabled: ${[...unusedPermissions].join( ", " )}`] );
            }
        }

        // object types
        {
            for ( const [aclObjectType, query] of Object.entries( this.api.config.acl.objectTypes ) ) {

                // check kebab-case
                if ( !isKebabCase( aclObjectType ) ) return result( [500, `ACL object type "${aclObjectType}" must be in the kebab-case`] );

                // already registered
                if ( aclObjectType in this.#objectTypes ) return result( [500, `ACL object type "${aclObjectType}" is already registered`] );

                this.#objectTypes[aclObjectType] = query ? sql( query ).prepare() : null;
            }
        }

        // check api methods acl object types
        {
            for ( const method of Object.values( this.api.frontend.schema.methods ) ) {
                if ( !method.aclObjectTypes ) continue;

                for ( const aclObjectType of method.aclObjectTypes ) {
                    if ( !( aclObjectType in this.#objectTypes ) ) {
                        return result( [500, `ACL object type "${aclObjectType}" is not registered`] );
                    }
                }
            }
        }

        // XXX
        // sync data
        const res = await this.dbh.begin( async dbh => {
            var res;

            // set transaction level lock
            res = await dbh.selectRow( sql`SELECT pg_advisory_xact_lock( ${dbh.schema.getLockId( "api/acl/sync" )} )` );
            if ( !res.ok ) throw res;

            res = await dbh.select( sql`
SELECT
    acl_type.id AS type_id,
    acl_type.type,
    acl_type.enabled AS type_enabled,
    acl_scope.id AS scope_id,
    acl_scope.scope,
    acl_scope.enabled AS scope_enabled,
    acl_permission.permission
FROM
    acl_type
    LEFT JOIN acl_scope ON ( acl_type.id = acl_scope.acl_type_id )
    LEFT JOIN acl_permission ON ( acl_scope.id = acl_permission.acl_scope_id )
` );
            if ( !res.ok ) throw res;

            const index = {};

            // build index
            if ( res.data ) {
                for ( const row of res.data ) {
                    index[row.type] ??= {};
                    index[row.type].id = row.type_id;
                    index[row.type].enabled = row.type_enabled;

                    index[row.type].scopes ??= {};
                    index[row.type].scopes[row.scope] ??= {};
                    index[row.type].scopes[row.scope].id = row.scope_id;
                    index[row.type].scopes[row.scope].enabled = row.scope_enabled;

                    index[row.type].scopes[row.scope].permissions ??= {};
                    index[row.type].scopes[row.scope].permissions[row.permission] = true;
                }
            }

            for ( const type of Object.values( this.#types ) ) {

                // acl type added
                if ( index[type.type] ) {

                    //
                }
            }
        } );

        if ( !res.ok ) return res;

        // setup dbh events
        this.dbh.on( "api/acl/update", data => {
            const cacheId = data.acl_id + "/" + data.user_id;

            if ( this.#aclUserUserCache.has( cacheId ) ) {
                this.#aclUserUserCache.get( cacheId ).enabled = data.enabled;
            }
        } );

        this.dbh.on( "api/acl/delete", data => {
            const cacheId = data.acl_id + "/" + data.user_id;

            this.#aclUserUserCache.delete( cacheId );
        } );

        this.dbh.on( "disconnect", () => this.#aclUserUserCache.clear() );

        return result( 200 );
    }

    // private
    async #resolveAclId ( aclObjectId, aclObjectType ) {
        const resolver = this.#objectTypes[aclObjectType];

        if ( !resolver ) return aclObjectId;

        const cacheId = `${aclObjectType}/${aclObjectId}`;

        var aclId = this.#aclObjectIdCache.get( cacheId );

        if ( aclId ) return aclId;

        const mutex = this.#mutexSet.get( `resolve/${cacheId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        const res = await this.dbh.selectRow( resolver, [aclObjectId] );

        aclId = res.data?.id;

        if ( aclId ) this.#aclObjectIdCache.set( cacheId, aclId );

        mutex.signal.broadcast( aclId );
        mutex.up();

        return aclId;
    }

    async #getAclType ( aclId, { dbh } = {} ) {
        var aclType = this.#aclIdCache.get( aclId );

        if ( aclType ) return aclType;

        dbh ||= this.dbh;

        const mutex = this.#mutexSet.get( `type/${aclId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        const res = await dbh.selectRow( QUERIES.getAclType, [aclId] );

        aclType = res.data?.type;

        if ( aclType && this.#types[aclType] ) {
            this.#aclIdCache.set( aclId, aclType );
        }
        else {
            aclType = null;
        }

        mutex.signal.broadcast( aclType );
        mutex.up();

        return aclType;
    }

    async #getAclUser ( aclId, userId, { dbh } = {} ) {
        const aclType = await this.#getAclType( aclId );
        if ( !aclType ) return;

        const cacheId = aclId + "/" + userId;

        var user = this.#aclUserUserCache.get( cacheId );

        if ( user ) return user;

        const mutex = this.#mutexSet.get( `role/${cacheId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await this.dbh.selectRow( QUERIES.getAclUser, [aclId, userId] );

        user = res.data;

        if ( user ) {
            user.roles = new Set( user.roles );

            this.#aclUserUserCache.set( cacheId, user );
        }

        mutex.signal.broadcast( user );
        mutex.up();

        return user;
    }
}
