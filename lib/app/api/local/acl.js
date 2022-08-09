import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import { isKebabCase } from "#lib/utils/naming-conventions";
import Mutex from "#lib/threads/mutex";

const QUERIES = {
    "getObjectType": sql`SELECT acl_type.type FROM acl_type, acl_object WHERE acl_object.acl_type_id = acl_type.id AND acl_object.id = ?`.prepare(),

    "getUser": sql`
SELECT
    enabled,
    ( SELECT json_agg( acl_type_role.role ) FROM acl_type_role, acl_role WHERE acl_type_role.id = acl_role.acl_type_role_id AND acl_id = acl.id ) AS roles
FROM
    acl
WHERE
    object_id = ?
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
        #objectTypeCache;
        #objectUserCache;
        #objectResolverCache;
        #types = {};
        #mutexSet = new Mutex.Set( { "destroyOnFinish": true } );

        // public
        async checkAclPermissions ( objectId, userId, method, objectIdType ) {
            if ( this.userIsRoot( userId ) ) return true;

            // resolve object id
            if ( typeof objectIdType === "string" ) {
                objectId = await this.#resolveObjectId( objectId, objectIdType, method );
                if ( !objectId ) return false;
            }

            const type = await this.#getAclObjectType( objectId );
            if ( !type ) return false;
            const typeSpec = this.#types[type];

            const user = await this.#getAclUser( objectId, userId );
            if ( !user || !user.enabled ) return false;

            const methodId = method.id;

            // check roles permissions
            for ( const role of user.roles ) {
                const roleSpec = typeSpec.roles[role];

                if ( !roleSpec ) continue;

                let enabled = roleSpec.permissionsCache[methodId];

                if ( enabled ) {
                    return true;
                }
                else if ( enabled == null ) {
                    enabled = this.#matchPermissions( method, roleSpec.permissions );

                    roleSpec.permissionsCache[methodId] = enabled;

                    if ( enabled ) return true;
                }
            }

            return false;
        }

        async setAclUserRoles ( objectId, userId, { dbh, parentUserId, enabled, roles = [] } = {} ) {
            if ( this.userIsRoot( userId ) ) return result( [400, `Unable to set roles`] );

            dbh ||= this.dbh;

            const objectType = await this.#getAclObjectType( objectId, { dbh } );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            var parentUser;

            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                parentUser = await this.#getAclUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to set user roles`] );
            }

            roles = new Set( roles );

            // validate roles
            for ( const role of roles ) {
                if ( !this.#types[objectType].roles[role] ) return result( [400, `Role is invalid`] );

                if ( parentUser && !parentUser.roles.has( role ) ) return result( [400, `Unable to set roles`] );
            }

            const res = await dbh.begin( async dbh => {
                var res = await dbh.selectRow( QUERIES.upsertUser, [objectId, userId, enabled] );
                if ( !res.ok ) throw res;

                if ( roles.size ) {
                    const values = [];

                    for ( const role of roles ) {
                        values.push( {
                            "acl_id": res.data.id,
                            "acl_type_role_id": sql`SELECT acl_type_role.id FROM acl_type_role, acl_type WHERE acl_type_role.acl_type_id = acl_type.id AND acl_type.type = ${objectType} AND acl_type_role.role = ${role}`,
                        } );
                    }

                    res = await dbh.do( sql`INSERT INTO acl_role`.VALUES( values ) );
                    if ( !res.ok ) throw res;
                }
            } );

            if ( !res.ok ) return res;

            // drop cache
            const cacheId = objectId + "/" + userId;
            this.#objectUserCache.delete( cacheId );

            return res;
        }

        async deleteAclUser ( objectId, userId, { dbh, parentUserId } = {} ) {

            // check parent user
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.#getAclUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to delete user`] );
            }

            dbh ||= this.dbh;

            const res = await dbh.do( QUERIES.deleteUser, [objectId, userId] );

            if ( res.meta.rows ) {

                // drop cache
                const cacheId = objectId + "/" + userId;
                this.#objectUserCache.delete( cacheId );
            }

            return res;
        }

        async setAclUserEnabled ( objectId, userId, enabled, { dbh, parentUserId } = {} ) {

            // check parent user
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.#getAclUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to delete user`] );
            }

            dbh ||= this.dbh;

            const res = await dbh.do( QUERIES.setUserEnabled, [enabled, objectId, userId] );

            if ( res.meta.rows ) {

                // drop cache
                const cacheId = objectId + "/" + userId;
                if ( this.#objectUserCache.has( cacheId ) ) this.#objectUserCache.get( cacheId ).enabled = enabled;
            }

            return res;
        }

        async setAclUserRoleEnabled ( objectId, userId, role, enabled, { dbh, parentUserId } = {} ) {
            dbh ||= this.dbh;

            // get object type
            const objectType = await this.#getAclObjectType( objectId, { dbh } );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            // validate role
            if ( !this.#types[objectType].roles[role] ) return result( [400, `Role is invalid`] );

            // get user
            const user = await this.#getAclUser( objectId, userId, { dbh } );
            if ( !user ) return result( 500 );

            // check parent user roles
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.#getAclUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to set role`] );

                if ( !parentUser.roles.has( role ) ) return result( [400, `Unable to set role`] );
            }

            var res;

            if ( enabled ) {
                res = await this.dbh.do( QUERIES.insertRole, [objectId, userId, objectType, role] );
            }
            else {
                res = await this.dbh.do( QUERIES.deleteRole, [objectId, userId, objectType, role] );
            }

            if ( !res.ok ) return res;

            // update cache
            const cacheId = objectId + "/" + userId;
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

        async getAclRoles ( objectId, { parentUserId } = {} ) {
            const objectType = await this.#getAclObjectType( objectId );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            var parentUserRoles;

            // check parent user roles
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.#getAclUser( objectId, parentUserId );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to get roles`] );

                parentUserRoles = parentUser.roles;
            }

            const roles = [];

            for ( const roleId of Object.keys( this.#types[objectType].roles ).sort() ) {
                const role = this.#types[objectType].roles[roleId];

                roles.push( {
                    "id": role.id,
                    "name": role.name,
                    "description": role.description,
                    "readonly": parentUserRoles ? !parentUserRoles.has( role.id ) : false,
                } );
            }

            return result( 200, roles );
        }

        async getAclUsers ( objectId, { parentUserId } ) {
            const objectType = await this.#getAclObjectType( objectId );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            const res = await this.dbh.select( QUERIES.getUsers, ["?d=" + this.app.config.defaultGravatarImage, this.app.config.defaultGravatarUrl, objectId] );

            if ( res.data ) {
                const roles = await this.getAclRoles( objectId, { parentUserId } );
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

        async getAclPermissions ( objectId, userId ) {
            if ( this.userIsRoot( userId ) ) return;

            const type = await this.#getAclObjectType( objectId );
            if ( !type ) return;
            const typeSpec = this.#types[type];

            const user = await this.#getAclUser( objectId, userId );
            if ( !user || !user.enabled ) return;

            const permissions = [];

            for ( const role of user.roles ) {
                if ( !typeSpec.roles[role] ) continue;

                permissions.push( ...typeSpec.roles[role].permissions );
            }

            return [...new Set( permissions )];
        }

        // protected
        async _init ( options ) {
            this.#objectTypeCache = new CacheLru( { "maxSize": this.app.config.objectUserCacheMaxSize } );
            this.#objectUserCache = new CacheLru( { "maxSize": this.app.config.objectUserCacheMaxSize } );
            this.#objectResolverCache = new CacheLru( { "maxSize": this.app.config.objectUserCacheMaxSize } );

            var res;

            if ( this.app.config.acl ) {
                process.stdout.write( "Loading object user roles ... " );
                res = await this.#init( this.app.config.acl );
                console.log( res + "" );

                if ( !res.ok ) return res;
            }

            res = super._init ? await super._init( options ) : result( 200 );

            return res;
        }

        // private
        async #init ( acl ) {
            const insertRoles = new Map();

            // types
            for ( const [type, spec] of Object.entries( acl ) ) {
                if ( !isKebabCase( type ) ) return result( [500, `Object type "${type}" must be in the kebab-case`] );

                // check roles
                for ( const [role, roleSpec] of Object.entries( spec.roles ) ) {
                    if ( !isKebabCase( role ) ) return result( [500, `Object role "${role}" must be in the kebab-case`] );

                    roleSpec.id = role;
                    roleSpec.permissionsCache = {};

                    insertRoles.set( `${type}/${role}`, { type, role } );
                }

                this.#types[type] = {
                    "roles": spec.roles,
                };
            }

            // sync data
            const res = await this.dbh.begin( async dbh => {

                // set transaction level lock
                var res = await dbh.selectRow( sql`SELECT pg_advisory_xact_lock(${dbh.schema.locks["api/acl/sync"]})` );
                if ( !res.ok ) throw res;

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

                // sync roles
                res = await dbh.select( sql`SELECT acl_type_role.id, acl_type.type, acl_type_role.role, acl_type_role.enabled FROM acl_type, acl_type_role WHERE acl_type.id = acl_type_role.acl_type_id` );
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
                    res = await dbh.do( sql`INSERT INTO acl_type_role`.VALUES( [...insertRoles.values()].map( data => ( {
                        "acl_type_id": sql`SELECT id FROM acl_type WHERE type = ${data.type}`,
                        "role": data.role,
                    } ) ) ) );
                    if ( !res.ok ) throw res;
                }

                // disable roles
                if ( disableRoles.size ) {
                    res = await dbh.do( sql`UPDATE acl_type_role SET enabled = FALSE WHERE id`.IN( [...disableRoles] ) );
                    if ( !res.ok ) throw res;
                }

                // enable roles
                if ( enableRoles.size ) {
                    res = await dbh.do( sql`UPDATE acl_type_role SET enabled = TRUE WHERE id`.IN( [...enableRoles] ) );
                    if ( !res.ok ) throw res;
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

        async #resolveObjectId ( id, type, method ) {
            const cacheId = `${type}/${id}`;

            var objectId = this.#objectResolverCache.get( cacheId );

            if ( objectId ) return objectId;

            const mutex = this.#mutexSet.get( `resolve/${cacheId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            const res = await this.dbh.selectRow( method.module.objectIdResolvers[type], [id] );

            objectId = res.data?.id;

            if ( objectId ) this.#objectResolverCache.set( cacheId, objectId );

            mutex.signal.broadcast( objectId );
            mutex.up();

            return objectId;
        }

        async #getAclObjectType ( objectId, { dbh } = {} ) {
            var type = this.#objectTypeCache.get( objectId );

            if ( type ) return type;

            dbh ||= this.dbh;

            const mutex = this.#mutexSet.get( `type/${objectId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            const res = await dbh.selectRow( QUERIES.getObjectType, [objectId] );

            type = res.data?.type;

            if ( type && this.#types[type] ) {
                this.#objectTypeCache.set( objectId, type );
            }
            else {
                type = null;
            }

            mutex.signal.broadcast( type );
            mutex.up();

            return type;
        }

        async #getAclUser ( objectId, userId, { dbh } = {} ) {
            const objectType = await this.#getAclObjectType( objectId );
            if ( !objectType ) return;

            const cacheId = objectId + "/" + userId;

            var roles = this.#objectUserCache.get( cacheId );

            if ( roles ) return roles;

            const mutex = this.#mutexSet.get( `role/${cacheId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            dbh ||= this.dbh;

            const res = await this.dbh.selectRow( QUERIES.getUser, [objectId, userId] );

            if ( res.data ) {
                res.data.roles = new Set( res.data.roles );

                this.#objectUserCache.set( cacheId, res.data );
            }

            mutex.signal.broadcast( res.data );
            mutex.up();

            return res.data;
        }

        #matchPermissions ( method, permissions ) {
            if ( !permissions ) return false;

            const namespace = method.namespace + "/";

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
