import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import { isKebabCase } from "#lib/utils/naming-conventions";
import Mutex from "#lib/threads/mutex";

const QUERIES = {
    "getObjectType": sql`SELECT object_type.type FROM object_type, objects_registry WHERE objects_registry.object_type_id = object_type.id AND objects_registry.id = ?`.prepare(),

    "getObjectUserRoles": sql`SELECT role FROM object_user WHERE object_id = ? AND user_id = ?`.prepare(),

    "upsertObjectUser": sql`
INSERT INTO object_user ( object_id, user_id , role ) VALUES ( ?, ?, ? )
ON CONFLICT ( object_id, user_id  ) DO UPDATE SET role = EXCLUDED.role
`.prepare(),

    "deleteObjectUser": sql`DELETE FROM object_user WHERE object_id = ? AND user_id = ?`.prepare(),

    "getObjectsUsers": sql`
SELECT
    object_user.user_id AS id,
    "user".name AS username,
    object_user.role AS role_id,
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
        #objectResolverCache;
        #objectUserRoleCache;
        #types = {};
        #resolvers = {};
        #mutexSet = new Mutex.Set( { "destroyOnFinish": true } );

        // public
        async checkObjectPermissions ( objectId, objectResolverType, userId, methodId ) {
            if ( this.userIsRoot( userId ) ) return true;

            // resolve object id
            if ( typeof objectResolverType === "string" ) {
                objectId = await this.resolveObjectId( objectId, objectResolverType );

                if ( !objectId ) return;
            }

            const type = await this.getObjectType( objectId );

            if ( !type ) return;

            const roles = await this.getObjectUserRoles( objectId, userId );

            if ( !roles ) return;

            for ( const role in roles ) {
                if ( !roles[role] ) continue;

                if ( this.#types[type]?.[role]?.permissions?.[methodId] ) return true;
            }
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

        async getObjectUserRoles ( objectId, userId, { dbh } = {} ) {
            const objectType = await this.getObjectType( objectId );
            if ( !objectType ) return;

            const cacheId = objectId + "/" + userId;

            var roles = this.#objectUserRoleCache.get( cacheId );

            if ( roles ) return roles;

            const mutex = this.#mutexSet.get( `role/${cacheId}` );
            if ( !mutex.tryDown() ) return mutex.signal.wait();

            dbh ||= this.dbh;

            const res = await this.dbh.selectRow( QUERIES.getObjectUserRoles, [objectId, userId] );

            roles = res.data?.roles;

            if ( roles ) {
                this.#objectUserRoleCache.set( cacheId, roles );
            }
            else {
                roles = null;
            }

            mutex.signal.broadcast( roles );
            mutex.up();

            return roles;
        }

        async addObjectUserRole ( objectId, userId, role, { dbh } = {} ) {
            dbh ||= this.dbh;

            const objectType = await this.getObjectType( objectId, { dbh } );
            if ( !objectType ) return result( [400, `Object type is invalid`] );
            if ( !this.#types[objectType][role] ) return result( [400, `Role is invalid`] );

            const roles = await this.getObjectUserRoles( objectId, userId, { dbh } );
            if ( !roles ) return result( 500 );

            if ( roles[role] ) return result( 200 );

            roles[role] = true;

            const res = await dbh.do( QUERIES.upsertObjectUser, [objectId, userId, roles] );

            if ( !res.ok ) return res;

            const cacheId = objectId + "/" + userId;
            this.#objectUserRoleCache.set( cacheId, role );

            return res;
        }

        async deleteObjectUserRole ( objectId, userId, role, { dbh } = {} ) {
            dbh ||= this.dbh;

            const objectType = await this.getObjectType( objectId, { dbh } );
            if ( !objectType ) return result( [400, `Object type is invalid`] );
            if ( !this.#types[objectType][role] ) return result( [400, `Role is invalid`] );

            const roles = await this.getObjectUserRoles( objectId, userId, { dbh } );
            if ( !roles ) return result( 500 );

            if ( !roles[role] ) return result( 200 );

            delete roles[role];

            const res = await dbh.do( QUERIES.upsertObjectUser, [objectId, userId, roles] );

            if ( !res.ok ) return res;

            const cacheId = objectId + "/" + userId;
            this.#objectUserRoleCache.set( cacheId, role );

            return res;
        }

        async deleteObjectUser ( objectId, userId, { dbh } = {} ) {
            dbh ||= this.dbh;

            const res = await dbh.do( QUERIES.deleteObjectUser, [objectId, userId] );

            if ( res.meta.rows ) {
                const cacheId = objectId + "/" + userId;

                this.#objectUserRoleCache.delete( cacheId );
            }

            return res;
        }

        async getObjectUsers ( objectId ) {
            const objectType = await this.getObjectType( objectId );
            if ( !this.#types[objectType] ) return result( [400, `Object type is invalid`] );

            const res = await this.dbh.select( QUERIES.getObjectsUsers, ["?d=" + this.app.config.defaultGravatarImage, this.app.config.defaultGravatarUrl, objectId] );

            if ( res.data ) {
                const roles = this.#types[objectType];

                res.data = res.data
                    .filter( row => roles[row.role_id] )
                    .map( row => {
                        row.role_name = roles[row.role_id].name;
                        row.role_description = roles[row.role_id].description;

                        return row;
                    } );
            }

            return res;
        }

        async getObjectRoles ( objectId ) {
            const objectType = await this.getObjectType( objectId );
            if ( !this.#types[objectType] ) return result( [400, `Object type is invalid`] );

            return result( 200, Object.values( this.#types[objectType] ) );
        }

        // protected
        async _init ( options ) {
            this.#objectTypeCache = new CacheLru( { "maxSize": this.app.config.objectUserCacheMaxSize } );
            this.#objectResolverCache = new CacheLru( { "maxSize": this.app.config.objectUserCacheMaxSize } );
            this.#objectUserRoleCache = new CacheLru( { "maxSize": this.app.config.objectUserCacheMaxSize } );

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

                if ( this.#objectUserRoleCache.has( cacheId ) ) this.#objectUserRoleCache.set( cacheId, data.role );
            } );

            this.dbh.on( "api/object-user/delete", data => {
                const cacheId = data.object_id + "/" + data.user_id;

                this.#objectUserRoleCache.delete( cacheId );
            } );

            this.dbh.on( "disconnect", () => this.#objectUserRoleCache.clear() );

            return result( 200 );
        }
    };
