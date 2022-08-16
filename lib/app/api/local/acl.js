import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import { isKebabCase } from "#lib/utils/naming-conventions";
import Mutex from "#lib/threads/mutex";

const ACL_OBJECT_TYPE = "acl";

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
            acl_user_role.acl_id = ?
            AND acl_user_role.user_id = ?
            AND acl_user_role.acl_role_id = acl_role.id
    ) AS roles
FROM
    acl_user
WHERE
    acl_id = ?
    AND user_id = ?
`.prepare(),

    "upsertUser": sql`
INSERT INTO acl ( object_id, user_id , enabled ) VALUES ( ?, ?, ? )
ON CONFLICT ( object_id, user_id  ) DO UPDATE SET enabled = EXCLUDED.enabled
RETURNING id
`.prepare(),

    "deleteUser": sql`DELETE FROM acl WHERE object_id = ? AND user_id = ?`.prepare(),

    "setUserEnabled": sql`UPDATE acl SET enabled = ? WHERE object_id = ? AND user_id = ?`.prepare(),

    "getUsers": sql`
SELECT
    acl.user_id AS id,
    "user".name AS username,
    acl.enabled AS enabled,
    ( SELECT json_agg( acl_type_role.role ) FROM acl_type_role, acl_role WHERE acl_type_role.id = acl_role.acl_type_role_id AND acl_id = acl.id ) AS roles,
    CASE
        WHEN "user".gravatar IS NOT NULL
        THEN 'https://s.gravatar.com/avatar/' || "user".gravatar || ?
        ELSE ?
    END avatar
FROM
    acl, "user"
WHERE
    acl.user_id = "user".id AND acl.object_id = ?
`.prepare(),

    "insertRole": sql`
INSERT INTO acl_role (
    acl_id,
    acl_type_role_id
) VALUES (
    ( SELECT id FROM acl WHERE object_id = ? AND user_id = ? ),
    ( SELECT acl_type_role.id FROM acl_type_role, acl_type WHERE acl_type_role.acl_type_id = acl_type.id AND acl_type.type = ? AND acl_type_role.role = ? )
) ON CONFLICT ( acl_id, acl_type_role_id ) DO NOTHING
`.prepare(),

    "deleteRole": sql`
DELETE
FROM
    acl_role
WHERE
    acl_id = ( SELECT id FROM acl WHERE object_id = ? AND user_id = ? )
    AND acl_type_role_id = ( SELECT acl_type_role.id FROM acl_type_role, acl_type WHERE acl_type_role.acl_type_id = acl_type.id AND acl_type.type = ? AND acl_type_role.role = ? )
`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {
        #types = {};
        #objectTypes = {};
        #mutexSet = new Mutex.Set( { "destroyOnFinish": true } );

        #objectTypeCache;
        #objectUserCache;
        #objectResolverCache;

        // public
        async checkAclPermissions ( aclObjectId, aclObjectType, userId, method ) {
            if ( this.userIsRoot( userId ) ) return true;

            // resolve object id
            const aclId = await this.#resolveAclId( aclObjectId, aclObjectType );
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

        async setAclUserRoles ( aclId, userId, { dbh, parentUserId, enabled, roles = [] } = {} ) {
            if ( this.userIsRoot( userId ) ) return result( [400, `Unable to set roles`] );

            dbh ||= this.dbh;

            const aclType = await this.#getAclType( aclId, { dbh } );
            if ( !aclType ) return result( [400, `ACL type is invalid`] );

            var parentUser;

            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to set user roles`] );
            }

            roles = new Set( roles );

            // validate roles
            for ( const role of roles ) {
                if ( !this.#types[aclType].roles[role] ) return result( [400, `Role is invalid`] );

                if ( parentUser && !parentUser.roles.has( role ) ) return result( [400, `Unable to set roles`] );
            }

            const res = await dbh.begin( async dbh => {
                var res = await dbh.selectRow( QUERIES.upsertUser, [aclId, userId, enabled] );
                if ( !res.ok ) throw res;

                if ( roles.size ) {
                    const values = [];

                    for ( const role of roles ) {
                        values.push( {
                            "acl_id": res.data.id,
                            "acl_type_role_id": sql`SELECT acl_type_role.id FROM acl_type_role, acl_type WHERE acl_type_role.acl_type_id = acl_type.id AND acl_type.type = ${aclType} AND acl_type_role.role = ${role}`,
                        } );
                    }

                    res = await dbh.do( sql`INSERT INTO acl_role`.VALUES( values ) );
                    if ( !res.ok ) throw res;
                }
            } );

            if ( !res.ok ) return res;

            // drop cache
            const cacheId = aclId + "/" + userId;
            this.#objectUserCache.delete( cacheId );

            return res;
        }

        async deleteAclUser ( aclId, userId, { dbh, parentUserId } = {} ) {

            // check parent user
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to delete user`] );
            }

            dbh ||= this.dbh;

            const res = await dbh.do( QUERIES.deleteUser, [aclId, userId] );

            if ( res.meta.rows ) {

                // drop cache
                const cacheId = aclId + "/" + userId;
                this.#objectUserCache.delete( cacheId );
            }

            return res;
        }

        async setAclUserEnabled ( aclId, userId, enabled, { dbh, parentUserId } = {} ) {

            // check parent user
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to delete user`] );
            }

            dbh ||= this.dbh;

            const res = await dbh.do( QUERIES.setUserEnabled, [enabled, aclId, userId] );

            if ( res.meta.rows ) {

                // drop cache
                const cacheId = aclId + "/" + userId;
                if ( this.#objectUserCache.has( cacheId ) ) this.#objectUserCache.get( cacheId ).enabled = enabled;
            }

            return res;
        }

        async setAclUserRoleEnabled ( aclId, userId, role, enabled, { dbh, parentUserId } = {} ) {
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
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );

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
            if ( this.#objectUserCache.has( cacheId ) ) {
                if ( enabled ) {
                    this.#objectUserCache.get( cacheId ).roles.add( role );
                }
                else {
                    this.#objectUserCache.get( cacheId ).roles.delete( role );
                }
            }

            return res;
        }

        async getAclRoles ( aclId, { parentUserId } = {} ) {
            const aclType = await this.#getAclType( aclId );
            if ( !aclType ) return result( [400, `ACL type is invalid`] );

            var parentUserRoles;

            // check parent user roles
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.#getAclUser( aclId, parentUserId );

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

        async getAclUsers ( aclId, { parentUserId } ) {
            const aclType = await this.#getAclType( aclId );
            if ( !aclType ) return result( [400, `Object type is invalid`] );

            const res = await this.dbh.select( QUERIES.getUsers, ["?d=" + this.app.config.defaultGravatarImage, this.app.config.defaultGravatarUrl, aclId] );

            if ( res.data ) {
                const roles = await this.getAclRoles( aclId, { parentUserId } );
                if ( !roles.ok ) return roles;

                for ( const row of res.data ) {
                    row.enabled_readonly = parentUserId ? row.id === parentUserId : false;

                    const userRoles = [],
                        rowRoles = new Set( row.roles );

                    for ( const role of roles.data ) {
                        userRoles.push( {
                            ...role,
                            "enabled": rowRoles.has( role.id ),
                            "readonly": parentUserId && parentUserId === row.id ? true : role.readonly,
                        } );
                    }

                    row.roles = userRoles;
                }
            }

            return res;
        }

        // protected
        async _init ( options ) {
            this.#objectTypeCache = new CacheLru( { "maxSize": this.app.config.objectUserCacheMaxSize } );
            this.#objectUserCache = new CacheLru( { "maxSize": this.app.config.objectUserCacheMaxSize } );
            this.#objectResolverCache = new CacheLru( { "maxSize": this.app.config.objectUserCacheMaxSize } );

            var res;

            if ( this.app.config.acl ) {
                process.stdout.write( "Loading ACL ... " );
                res = await this.#init( this.app.config.acl );
                console.log( res + "" );

                if ( !res.ok ) return res;
            }

            res = super._init ? await super._init( options ) : result( 200 );

            return res;
        }

        // private
        async #init ( acl ) {
            const insertRoles = new Map(),
                objectPermissions = [];

            // types
            {
                for ( const [aclType, spec] of Object.entries( acl.types ) ) {
                    if ( !isKebabCase( aclType ) ) return result( [500, `ACL type "${aclType}" must be in the kebab-case`] );

                    // roles
                    if ( spec.roles ) {
                        for ( const [role, roleSpec] of Object.entries( spec.roles ) ) {
                            if ( !isKebabCase( role ) ) return result( [500, `ACL role "${role}" must be in the kebab-case`] );

                            roleSpec.id = role;

                            // pre-calculate role permissions
                            const permissions = {};

                            for ( const method of Object.values( this.schema.methods ) ) {
                                if ( this.#matchPermissions( method, roleSpec.permissions ) ) {
                                    permissions[method.id] = true;
                                }
                            }

                            roleSpec.permissions = permissions;

                            insertRoles.set( `${aclType}/${role}`, { "type": aclType, role } );
                        }
                    }

                    if ( this.#types[aclType] ) throw `ACL type "${aclType}" is alredy registered`;

                    this.#types[aclType] = {
                        "roles": spec.roles,
                    };
                }
            }

            // object types
            {
                for ( const [aclObjectType, spec] of Object.entries( acl.objectTypes ) ) {
                    if ( aclObjectType === ACL_OBJECT_TYPE ) return result( [500, `ACL object type "${ACL_OBJECT_TYPE}" is reserver`] );

                    if ( !isKebabCase( aclObjectType ) ) return result( [500, `ACL object type "${aclObjectType}" must be in the kebab-case`] );

                    if ( this.#objectTypes[aclObjectType] ) throw `ACL object type "${aclObjectType}" is alredy registered`;

                    this.#objectTypes[aclObjectType] = {};

                    if ( spec.isAclObject ) this.#objectTypes[aclObjectType].isAclObject = true;

                    if ( spec.resolver ) this.#objectTypes[aclObjectType].resolver = sql( spec.resolver ).prepare();
                }
            }

            // check api methods acl object types
            {
                for ( const method of Object.values( this.schema.methods ) ) {
                    if ( !method.aclObjectTypes ) continue;

                    for ( const aclObjectType of method.aclObjectTypes ) {
                        if ( aclObjectType === ACL_OBJECT_TYPE ) continue;

                        if ( !this.#objectTypes[aclObjectType] ) {
                            return result( [500, `ACL object type "${aclObjectType}" is not registered`] );
                        }
                    }
                }
            }

            // pre-calc permissions
            {
                for ( const aclObjectType in this.#objectTypes ) {
                    for ( const aclType in this.#types ) {
                        for ( const role in this.#types[aclType].roles ) {
                            const permissions = {};

                            for ( const method of Object.values( this.schema.methods ) ) {
                                if ( !method.aclObjectTypes ) continue;

                                if ( method.aclObjectTypes.has( aclObjectType ) || ( this.#objectTypes[aclObjectType].isAclObject && method.aclObjectTypes.has( ACL_OBJECT_TYPE ) ) ) {
                                    if ( this.#types[aclType].roles[role].permissions[method.id] ) {
                                        permissions[method.id] = true;
                                    }
                                }
                            }

                            objectPermissions.push( {
                                permissions,
                                "acl_object_id": sql`SELECT id FROM acl_object WHERE type = ${aclObjectType}`,
                                "acl_role_id": sql`SELECT acl_role.id FROM acl_role, acl_type WHERE acl_role.acl_type_id = acl_type.id AND acl_type.type = ${aclType} AND acl_role.role = ${role}`,
                            } );
                        }
                    }
                }
            }

            // sync data
            const res = await this.dbh.begin( async dbh => {

                // set transaction level lock
                var res = await dbh.selectRow( sql`SELECT pg_advisory_xact_lock( ${dbh.schema.getLockId( "api/acl/sync" )} )` );
                if ( !res.ok ) throw res;

                // sync acl types
                {
                    res = await dbh.select( sql`SELECT * FROM acl_type` );
                    if ( !res.ok ) throw res;

                    const insertTypes = new Set( Object.keys( this.#types ) ),
                        enableTypes = new Set(),
                        disableTypes = new Set();

                    if ( res.data ) {
                        for ( const row of res.data ) {

                            // type exists in the database but not exists locally
                            if ( !insertTypes.has( row.type ) ) {
                                disableTypes.add( row.id );
                            }

                            // type exists in the database and exists locally
                            else {
                                insertTypes.delete( row.type );

                                // type is disabled in the database
                                if ( !row.enabled ) enableTypes.add( row.id );
                            }
                        }
                    }

                    // insert types
                    if ( insertTypes.size ) {
                        res = await dbh.do( sql`INSERT INTO acl_type`.VALUES( [...insertTypes].map( type => ( { type } ) ) ) );
                        if ( !res.ok ) throw res;
                    }

                    // disable types
                    if ( disableTypes.size ) {
                        res = await dbh.do( sql`UPDATE acl_type SET enabled = FALSE WHERE id`.IN( [...disableTypes] ) );
                        if ( !res.ok ) throw res;
                    }

                    // enable types
                    if ( enableTypes.size ) {
                        res = await dbh.do( sql`UPDATE acl_type SET enabled = TRUE WHERE id`.IN( [...enableTypes] ) );
                        if ( !res.ok ) throw res;
                    }
                }

                // sync roles
                {
                    res = await dbh.select( sql`SELECT acl_role.id, acl_type.type, acl_role.role, acl_role.enabled FROM acl_type, acl_role WHERE acl_type.id = acl_role.acl_type_id` );
                    if ( !res.ok ) throw res;

                    const enableRoles = new Set(),
                        disableRoles = new Set();

                    if ( res.data ) {
                        for ( const row of res.data ) {
                            const id = `${row.type}/${row.role}`;

                            if ( !insertRoles.has( id ) ) {
                                disableRoles.add( row.id );
                            }
                            else {
                                insertRoles.delete( id );

                                if ( !row.enabled ) enableRoles.add( row.id );
                            }
                        }
                    }

                    // insert roles
                    if ( insertRoles.size ) {
                        res = await dbh.do( sql`INSERT INTO acl_role`.VALUES( [...insertRoles.values()].map( data => ( {
                            "acl_type_id": sql`SELECT id FROM acl_type WHERE type = ${data.type}`,
                            "role": data.role,
                        } ) ) ) );
                        if ( !res.ok ) throw res;
                    }

                    // disable roles
                    if ( disableRoles.size ) {
                        res = await dbh.do( sql`UPDATE acl_role SET enabled = FALSE WHERE id`.IN( [...disableRoles] ) );
                        if ( !res.ok ) throw res;
                    }

                    // enable roles
                    if ( enableRoles.size ) {
                        res = await dbh.do( sql`UPDATE acl_role SET enabled = TRUE WHERE id`.IN( [...enableRoles] ) );
                        if ( !res.ok ) throw res;
                    }
                }

                // sync object types
                {
                    res = await dbh.select( sql`SELECT * FROM acl_object` );
                    if ( !res.ok ) throw res;

                    const insertObjects = new Set( Object.keys( this.#objectTypes ) ),
                        deleteObjects = new Set();

                    if ( res.data ) {
                        for ( const row of res.data ) {

                            // type exists in the database but not exists locally
                            if ( !insertObjects.has( row.type ) ) {
                                deleteObjects.add( row.id );
                            }

                            // type exists in the database and exists locally
                            else {
                                insertObjects.delete( row.type );
                            }
                        }
                    }

                    // insert types
                    if ( insertObjects.size ) {
                        res = await dbh.do( sql`INSERT INTO acl_object`.VALUES( [...insertObjects].map( type => ( { type } ) ) ) );
                        if ( !res.ok ) throw res;
                    }

                    // disable types
                    if ( deleteObjects.size ) {
                        res = await dbh.do( sql`DELETE FROM acl_object WHERE id`.IN( [...deleteObjects] ) );
                        if ( !res.ok ) throw res;
                    }
                }

                // update object permissions
                {
                    if ( objectPermissions.length ) {
                        res = await dbh.do( sql`INSERT INTO acl_object_permissions`.VALUES( objectPermissions ).sql`ON CONFLICT ( acl_object_id, acl_role_id ) DO UPDATE SET permissions = EXCLUDED.permissions` );
                        if ( !res.ok ) throw res;
                    }
                }
            } );

            if ( !res.ok ) return res;

            // setup dbh events
            this.dbh.on( "api/acl/update", data => {
                const cacheId = data.object_id + "/" + data.user_id;

                if ( this.#objectUserCache.has( cacheId ) ) {
                    this.#objectUserCache.get( cacheId ).enabled = data.enabled;
                }
            } );

            this.dbh.on( "api/acl/delete", data => {
                const cacheId = data.object_id + "/" + data.user_id;

                this.#objectUserCache.delete( cacheId );
            } );

            this.dbh.on( "disconnect", () => this.#objectUserCache.clear() );

            return result( 200 );
        }

        async #resolveAclId ( aclObjectId, aclObjectType ) {
            if ( aclObjectType === ACL_OBJECT_TYPE ) return aclId;

            const resolver = this.#objectTypes[aclObjectType].resolver;

            if ( !resolver ) return aclId;

            const cacheId = `${aclObjectType}/${aclObjectId}`;

            var aclId = this.#objectResolverCache.get( cacheId );

            if ( aclId ) return aclId;

            const mutex = this.#mutexSet.get( `resolve/${cacheId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            const res = await this.dbh.selectRow( resolver, [aclObjectId] );

            aclId = res.data?.id;

            if ( aclId ) this.#objectResolverCache.set( cacheId, aclId );

            mutex.signal.broadcast( aclId );
            mutex.up();

            return aclId;
        }

        async #getAclType ( aclId, { dbh } = {} ) {
            var aclType = this.#objectTypeCache.get( aclId );

            if ( aclType ) return aclType;

            dbh ||= this.dbh;

            const mutex = this.#mutexSet.get( `type/${aclId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            const res = await dbh.selectRow( QUERIES.getAclType, [aclId] );

            aclType = res.data?.type;

            if ( aclType && this.#types[aclType] ) {
                this.#objectTypeCache.set( aclId, aclType );
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

            var user = this.#objectUserCache.get( cacheId );

            if ( user ) return user;

            const mutex = this.#mutexSet.get( `role/${cacheId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            dbh ||= this.dbh;

            const res = await this.dbh.selectRow( QUERIES.getAclUser, [aclId, userId] );

            user = res.data;

            if ( user ) {
                user.roles = new Set( user.roles );

                this.#objectUserCache.set( cacheId, user );
            }

            mutex.signal.broadcast( user );
            mutex.up();

            return user;
        }

        #matchPermissions ( method, permissions ) {
            if ( !permissions ) return false;

            // match enabled permissions
            const enabled = this.#matchPermissionsList(
                method,
                Object.keys( permissions ).filter( permission => permissions[permission] )
            );

            if ( !enabled ) return false;

            // match disabled permissions
            const disabled = this.#matchPermissionsList(
                method,
                Object.keys( permissions ).filter( permission => !permissions[permission] )
            );

            if ( disabled ) return false;

            return true;
        }

        #matchPermissionsList ( method, permissions ) {
            const namespace = method.namespace + "/";

            // check enabled permissions
            for ( const permission of permissions ) {
                if ( permission.endsWith( "/" ) ) {
                    if ( permission === namespace ) return true;
                }
                else if ( permission.endsWith( "/*" ) ) {
                    if ( namespace.startsWith( permission.substring( 0, permission.length - 1 ) ) ) return true;
                }
                else {
                    if ( permission === method.id ) return true;
                }
            }

            return false;
        }
    };
