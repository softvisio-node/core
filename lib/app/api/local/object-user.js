import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import { isKebabCase } from "#lib/utils/naming-conventions";
import Mutex from "#lib/threads/mutex";

const QUERIES = {
    "getObjectType": sql`SELECT object_type.type FROM object_type, objects_registry WHERE objects_registry.object_type_id = object_type.id AND objects_registry.id = ?`.prepare(),

    "getObjectUser": sql`SELECT enabled, roles FROM object_user WHERE object_id = ? AND user_id = ?`.prepare(),

    "upsertObjectUser": sql`
INSERT INTO object_user ( object_id, user_id , enabled, roles ) VALUES ( ?, ?, ?, ? )
ON CONFLICT ( object_id, user_id  ) DO UPDATE SET roles = EXCLUDED.roles
`.prepare(),

    "deleteObjectUser": sql`DELETE FROM object_user WHERE object_id = ? AND user_id = ?`.prepare(),

    "setObjectUserEnabled": sql`UPDATE object_user SET enabled = ? WHERE object_id = ? AND user_id = ?`.prepare(),

    "setObjectUserRoles": sql`UPDATE object_user SET roles = ? WHERE object_id = ? AND user_id = ?`.prepare(),

    "getObjectsUsers": sql`
SELECT
    object_user.user_id AS id,
    "user".name AS username,
    object_user.enabled AS enabled,
    object_user.roles AS roles,
    CASE
        WHEN "user".gravatar IS NOT NULL
        THEN 'https://s.gravatar.com/avatar/' || "user".gravatar || ?
        ELSE ?
    END avatar
FROM object_user, "user"
WHERE object_user.user_id = "user".id AND object_user.object_id = ?
`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {
        #objectTypeCache;
        #objectUserCache;
        #objectResolverCache;
        #types = {};
        #resolvers = {};
        #mutexSet = new Mutex.Set( { "destroyOnFinish": true } );

        // public
        // XXX matcher
        async checkObjectPermissions ( objectId, objectResolverType, userId, methodId ) {
            if ( this.userIsRoot( userId ) ) return true;

            // resolve object id
            if ( typeof objectResolverType === "string" ) {
                objectId = await this.resolveObjectId( objectId, objectResolverType );

                if ( !objectId ) return;
            }

            const type = await this.getObjectType( objectId );

            if ( !type ) return;

            const user = await this.getObjectUser( objectId, userId );

            if ( !user || !user.enabled ) return;

            for ( const role in user.roles ) {
                if ( !user.roles.has( role ) ) continue;

                if ( this.#types[type]?.[role]?.permissions?.[methodId] ) return true;
            }
        }

        async getObjectType ( objectId, { dbh } = {} ) {
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

        async getObjectUser ( objectId, userId, { dbh } = {} ) {
            const objectType = await this.getObjectType( objectId );
            if ( !objectType ) return;

            const cacheId = objectId + "/" + userId;

            var roles = this.#objectUserCache.get( cacheId );

            if ( roles ) return roles;

            const mutex = this.#mutexSet.get( `role/${cacheId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            dbh ||= this.dbh;

            const res = await this.dbh.selectRow( QUERIES.getObjectUser, [objectId, userId] );

            if ( res.data ) {
                res.data.roles = new Set( res.data.roles );

                this.#objectUserCache.set( cacheId, res.data );
            }

            mutex.signal.broadcast( res.data );
            mutex.up();

            return res.data;
        }

        async resolveObjectId ( id, type ) {
            const resolver = this.#resolvers[type];

            if ( !resolver ) {
                console.log( `Object id resolver ${type} is not registered` );

                return;
            }

            const cacheId = `${type}/${id}`;

            var objectId = this.#objectResolverCache.get( cacheId );

            if ( objectId ) return objectId;

            const mutex = this.#mutexSet.get( `resolve/${cacheId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            const res = await this.dbh.selectRow( resolver, [id] );

            objectId = res.data?.id;

            if ( objectId ) this.#objectResolverCache.set( cacheId, objectId );

            mutex.signal.broadcast( objectId );
            mutex.up();

            return objectId;
        }

        async setObjectUserRoles ( objectId, userId, { dbh, parentUserId, enabled, roles = [] } = {} ) {
            if ( this.userIsRoot( userId ) ) return result( [400, `Unable to set roles`] );

            dbh ||= this.dbh;

            const objectType = await this.getObjectType( objectId, { dbh } );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            var parentUser;

            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                parentUser = await this.getObjectUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to set user roles`] );
            }

            const _roles = new Set();

            // validate roles
            for ( const role of roles ) {
                if ( !this.#types[objectType][role] ) return result( [400, `Role is invalid`] );

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

        async deleteObjectUser ( objectId, userId, { dbh, parentUserId } = {} ) {

            // check parent user
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.getObjectUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to delete user`] );
            }

            dbh ||= this.dbh;

            const res = await dbh.do( QUERIES.deleteObjectUser, [objectId, userId] );

            if ( res.meta.rows ) {

                // drop cache
                const cacheId = objectId + "/" + userId;
                this.#objectUserCache.delete( cacheId );
            }

            return res;
        }

        async setObjectUserEnabled ( objectId, userId, enabled, { dbh, parentUserId } = {} ) {

            // check parent user
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.getObjectUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to delete user`] );
            }

            dbh ||= this.dbh;

            const res = await dbh.do( QUERIES.setObjectUserEnabled, [enabled, objectId, userId] );

            if ( res.meta.rows ) {

                // drop cache
                const cacheId = objectId + "/" + userId;
                if ( this.#objectUserCache.has( cacheId ) ) this.#objectUserCache.get( cacheId ).enabled = enabled;
            }

            return res;
        }

        async addObjectUserRole ( objectId, userId, role, { dbh, parentUserId } = {} ) {
            dbh ||= this.dbh;

            // get object type
            const objectType = await this.getObjectType( objectId, { dbh } );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            // validate role
            if ( !this.#types[objectType][role] ) return result( [400, `Role is invalid`] );

            // get user
            const user = await this.getObjectUser( objectId, userId, { dbh } );
            if ( !user ) return result( 500 );

            // check parent user roles
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.getObjectUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to set role`] );

                if ( !parentUser.roles.has( role ) ) return result( [400, `Unable to set role`] );
            }

            // role is already added
            if ( user.roles.has( role ) ) return result( 200 );

            user.roles.add( role );

            const res = await dbh.do( QUERIES.setObjectUserRoles, [[...user.roles], objectId, userId] );

            if ( !res.ok ) return res;
            if ( !res.meta.rows ) return result( 500 );

            // update cache
            const cacheId = objectId + "/" + userId;
            if ( this.#objectUserCache.has( cacheId ) ) this.#objectUserCache.get( cacheId ).roles.add( role );

            return res;
        }

        async deleteObjectUserRole ( objectId, userId, role, { dbh, parentUserId } = {} ) {
            dbh ||= this.dbh;

            // get object type
            const objectType = await this.getObjectType( objectId, { dbh } );
            if ( !objectType ) return result( [400, `Object type is invalid`] );

            // get user roles
            const user = await this.getObjectUser( objectId, userId, { dbh } );
            if ( !user ) return result( 500 );

            // role is already removed
            if ( !user.roles.has( role ) ) return result( 200 );

            // check parent user roles
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.getObjectUser( objectId, parentUserId, { dbh } );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to set role`] );

                if ( !parentUser.roles.has( role ) ) return result( [400, `Unable to set role`] );
            }

            user.roles.delete( role );

            const res = await dbh.do( QUERIES.setObjectUserRoles, [[...user.roles], objectId, userId] );

            if ( !res.ok ) return res;
            if ( !res.meta.rows ) return result( 500 );

            // update cache
            const cacheId = objectId + "/" + userId;
            if ( this.#objectUserCache.has( cacheId ) ) this.#objectUserCache.get( cacheId ).roles.delete( role );

            return res;
        }

        async getObjectRoles ( objectId, { parentUserId } = {} ) {
            const objectType = await this.getObjectType( objectId );
            if ( !this.#types[objectType] ) return result( [400, `Object type is invalid`] );

            var parentUserRoles;

            // check parent user roles
            if ( parentUserId && !this.userIsRoot( parentUserId ) ) {
                const parentUser = await this.getObjectUser( objectId, parentUserId );

                if ( !parentUser || !parentUser.enabled ) return result( [400, `Unable to get roles`] );

                parentUserRoles = parentUser.roles;
            }

            const roles = [];

            for ( const roleId of Object.keys( this.#types[objectType] ).sort() ) {
                const role = this.#types[objectType][roleId];

                roles.push( {
                    "id": role.id,
                    "name": role.name,
                    "description": role.description,
                    "readOnly": parentUserRoles ? !parentUserRoles[role.id] : false,
                } );
            }

            return result( 200, roles );
        }

        async getObjectUsers ( objectId, { parentUserId } ) {
            const objectType = await this.getObjectType( objectId );
            if ( !this.#types[objectType] ) return result( [400, `Object type is invalid`] );

            const res = await this.dbh.select( QUERIES.getObjectsUsers, ["?d=" + this.app.config.defaultGravatarImage, this.app.config.defaultGravatarUrl, objectId] );

            if ( res.data ) {
                const roles = await this.getObjectRoles( objectId, { parentUserId } );
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

            if ( this.app.config.objects ) {
                process.stdout.write( "Loading object user roles ... " );
                res = await this.#init( this.app.config.objects );
                console.log( res + "" );

                if ( !res.ok ) return res;
            }

            res = super._init ? await super._init( options ) : result( 200 );

            return res;
        }

        // private
        async #init ( objects ) {
            if ( objects.types ) {
                const types = [];

                for ( const [type, spec] of Object.entries( objects.types ) ) {
                    if ( !isKebabCase( type ) ) return result( [500, `Object type "${type}" must be in the kebab-case`] );

                    types.push( { type } );

                    for ( const [role, roleSpec] of Object.entries( spec ) ) {
                        if ( !isKebabCase( role ) ) return result( [500, `Object role "${role}" must be in the kebab-case`] );

                        roleSpec.id = role;
                    }

                    this.#types[type] = spec;
                }

                if ( types.length ) {
                    const res = await this.dbh.do( sql`INSERT INTO object_type`.VALUES( types ).sql`ON CONFLICT ( type ) DO NOTHING` );

                    if ( !res.ok ) return res;
                }
            }

            if ( objects.resolvers ) {
                for ( const [type, resolver] of Object.entries( objects.resolvers ) ) {
                    if ( !isKebabCase( type ) ) return result( [500, `Object type "${type}" must be in the kebab-case`] );

                    resolver.prepare();

                    this.#resolvers[type] = resolver;
                }
            }

            // setup dbh events
            this.dbh.on( "api/object-user/update", data => {
                const cacheId = data.object_id + "/" + data.user_id;

                if ( this.#objectUserCache.has( cacheId ) ) {
                    this.#objectUserCache.set( cacheId, {
                        "enabled": data.enabled,
                        "roles": new Set( data.roles ),
                    } );
                }
            } );

            this.dbh.on( "api/object-user/delete", data => {
                const cacheId = data.object_id + "/" + data.user_id;

                this.#objectUserCache.delete( cacheId );
            } );

            this.dbh.on( "disconnect", () => this.#objectUserCache.clear() );

            return result( 200 );
        }
    };
