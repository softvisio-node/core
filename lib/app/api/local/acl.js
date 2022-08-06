import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import { isKebabCase } from "#lib/utils/naming-conventions";
import Mutex from "#lib/threads/mutex";

const QUERIES = {
    "getAclObjectType": sql`SELECT acl_type.type FROM acl_type, acl_registry WHERE acl_registry.acl_type_id = acl_type.id AND acl_registry.id = ?`.prepare(),

    "getAclUser": sql`SELECT enabled, roles FROM acl WHERE object_id = ? AND user_id = ?`.prepare(),

    "upsertObjectUser": sql`
INSERT INTO acl ( object_id, user_id , enabled, roles ) VALUES ( ?, ?, ?, ? )
ON CONFLICT ( object_id, user_id  ) DO UPDATE SET roles = EXCLUDED.roles
`.prepare(),

    "deleteAclUser": sql`DELETE FROM acl WHERE object_id = ? AND user_id = ?`.prepare(),

    "setAclUserEnabled": sql`UPDATE acl SET enabled = ? WHERE object_id = ? AND user_id = ?`.prepare(),

    "setAclUserRoles": sql`UPDATE acl SET roles = ? WHERE object_id = ? AND user_id = ?`.prepare(),

    "getObjectsUsers": sql`
SELECT
    acl.user_id AS id,
    "user".name AS username,
    acl.enabled AS enabled,
    acl.roles AS roles,
    CASE
        WHEN "user".gravatar IS NOT NULL
        THEN 'https://s.gravatar.com/avatar/' || "user".gravatar || ?
        ELSE ?
    END avatar
FROM acl, "user"
WHERE acl.user_id = "user".id AND acl.object_id = ?
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
        async checkAcl ( objectId, objectResolverType, userId, method ) {
            if ( this.userIsRoot( userId ) ) return true;

            // resolve object id
            if ( typeof objectResolverType === "string" ) {
                objectId = await this.#resolveObjectId( objectId, objectResolverType, method );
                if ( !objectId ) return false;
            }

            const type = await this.getAclObjectType( objectId );
            if ( !type ) return false;
            const typeSpec = this.#types[type];

            const user = await this.getAclUser( objectId, userId );
            if ( !user || !user.enabled ) return false;

            const methodId = method.id;

            // check base permissions
            var enabled = typeSpec.permissionsCache[methodId];
            if ( enabled != null ) return enabled;

            // match and cache base permissions
            enabled = this.#matchPermissions( method, typeSpec.basePermissions );

            typeSpec.permissionsCache[methodId] = enabled;
            if ( !enabled ) return false;

            // check disabled permissions
            for ( const role of user.roles ) {
                const roleSpec = typeSpec.roles[role];

                if ( !roleSpec ) continue;

                enabled = roleSpec.permissionsCache[methodId];

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

        async getAclObjectType ( objectId, { dbh } = {} ) {
            var type = this.#objectTypeCache.get( objectId );

            if ( type ) return type;

            dbh ||= this.dbh;

            const mutex = this.#mutexSet.get( `type/${objectId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            const res = await dbh.selectRow( QUERIES.getAclObjectType, [objectId] );

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

        async getAclUser ( objectId, userId, { dbh } = {} ) {
            const objectType = await this.getAclObjectType( objectId );
            if ( !objectType ) return;

            const cacheId = objectId + "/" + userId;

            var roles = this.#objectUserCache.get( cacheId );

            if ( roles ) return roles;

            const mutex = this.#mutexSet.get( `role/${cacheId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            dbh ||= this.dbh;

            const res = await this.dbh.selectRow( QUERIES.getAclUser, [objectId, userId] );

            if ( res.data ) {
                res.data.roles = new Set( res.data.roles );

                this.#objectUserCache.set( cacheId, res.data );
            }

            mutex.signal.broadcast( res.data );
            mutex.up();

            return res.data;
        }

        async setAclUserRoles ( objectId, userId, { dbh, parentUserId, enabled, roles = [] } = {} ) {
            if ( this.userIsRoot( userId ) ) return result( [400, `Unable to set roles`] );

            dbh ||= this.dbh;

            const objectType = await this.getAclObjectType( objectId, { dbh } );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            var parentUser;

            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                parentUser = await this.getAclUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to set user roles`] );
            }

            const _roles = new Set();

            // validate roles
            for ( const role of roles ) {
                if ( !this.#types[objectType].roles[role] ) return result( [400, `Role is invalid`] );

                if ( parentUser && !parentUser.roles.has( role ) ) return result( [400, `Unable to set roles`] );

                _roles.add( role );
            }

            const res = await dbh.do( QUERIES.upsertObjectUser, [objectId, userId, enabled, [..._roles]] );

            if ( !res.ok ) return res;

            // drop cache
            const cacheId = objectId + "/" + userId;
            this.#objectUserCache.delete( cacheId );

            return res;
        }

        async deleteAclUser ( objectId, userId, { dbh, parentUserId } = {} ) {

            // check parent user
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.getAclUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to delete user`] );
            }

            dbh ||= this.dbh;

            const res = await dbh.do( QUERIES.deleteAclUser, [objectId, userId] );

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
                const parentUser = await this.getAclUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to delete user`] );
            }

            dbh ||= this.dbh;

            const res = await dbh.do( QUERIES.setAclUserEnabled, [enabled, objectId, userId] );

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
            const objectType = await this.getAclObjectType( objectId, { dbh } );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            // validate role
            if ( !this.#types[objectType].roles[role] ) return result( [400, `Role is invalid`] );

            // get user
            const user = await this.getAclUser( objectId, userId, { dbh } );
            if ( !user ) return result( 500 );

            // check parent user roles
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.getAclUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to set role`] );

                if ( !parentUser.roles.has( role ) ) return result( [400, `Unable to set role`] );
            }

            const roles = new Set( [...user.roles] );

            if ( enabled ) {
                if ( user.roles.has( role ) ) return result( 200 );

                roles.add( role );
            }
            else {
                if ( !user.roles.has( role ) ) return result( 200 );

                roles.delete( role );
            }

            const res = await dbh.do( QUERIES.setAclUserRoles, [[...roles], objectId, userId] );

            if ( !res.ok ) return res;
            if ( !res.meta.rows ) return result( 500 );

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
            const objectType = await this.getAclObjectType( objectId );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            var parentUserRoles;

            // check parent user roles
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.getAclUser( objectId, parentUserId );

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
                    "readOnly": parentUserRoles ? !parentUserRoles[role.id] : false,
                } );
            }

            return result( 200, roles );
        }

        async getAclUsers ( objectId, { parentUserId } ) {
            const objectType = await this.getAclObjectType( objectId );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            const res = await this.dbh.select( QUERIES.getObjectsUsers, ["?d=" + this.app.config.defaultGravatarImage, this.app.config.defaultGravatarUrl, objectId] );

            if ( res.data ) {
                const roles = await this.getAclRoles( objectId, { parentUserId } );
                if ( !roles.ok ) return roles;

                for ( const row of res.data ) {
                    const userRoles = [],
                        rowRoles = new Set( row.roles );

                    for ( const role of roles.data ) {
                        userRoles.push( {
                            ...role,
                            "enabled": rowRoles.has( role.id ),
                            "readOnly": parentUserId && parentUserId === row.id ? true : role.readOnly,
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
            const types = new Set();

            // types
            for ( const [type, spec] of Object.entries( acl ) ) {
                if ( !isKebabCase( type ) ) return result( [500, `Object type "${type}" must be in the kebab-case`] );

                types.add( type );

                // check roles
                for ( const [role, roleSpec] of Object.entries( spec.roles ) ) {
                    if ( !isKebabCase( role ) ) return result( [500, `Object role "${role}" must be in the kebab-case`] );

                    roleSpec.id = role;
                    roleSpec.permissionsCache = {};
                }

                this.#types[type] = {
                    "basePermissions": spec.basePermissions,
                    "permissionsCache": {},
                    "roles": spec.roles,
                };
            }

            // resolvers
            if ( types.size ) {
                const res = await this.dbh.select( sql`SELECT * FROM acl_type` );
                if ( !res.ok ) return res;

                if ( res.data ) {
                    for ( const row of res.data ) types.delete( row.type );
                }

                if ( types.size ) {
                    const res = await this.dbh.do( sql`INSERT INTO acl_type`.VALUES( [...types].map( type => ( { type } ) ) ).sql`ON CONFLICT ( type ) DO NOTHING` );
                    if ( !res.ok ) return res;
                }
            }

            // setup dbh events
            this.dbh.on( "api/acl/update", data => {
                const cacheId = data.object_id + "/" + data.user_id;

                if ( this.#objectUserCache.has( cacheId ) ) {
                    this.#objectUserCache.set( cacheId, {
                        "enabled": data.enabled,
                        "roles": new Set( data.roles ),
                    } );
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

        #matchPermissions ( method, permissions ) {
            if ( !permissions ) return false;

            for ( const permission of permissions ) {
                if ( permission.endsWith( "/" ) ) {
                    if ( permission === method.namespace + "/" ) return true;
                }
                else if ( permission.endsWith( "/*" ) ) {
                    if ( method.namespace.startsWith( permission.substring( 0, permission.length - 1 ) ) ) return true;
                }
                else {
                    if ( permission === method.id ) return true;
                }
            }

            return false;
        }
    };
