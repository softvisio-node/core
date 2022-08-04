import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import { isSnakeCase } from "#lib/utils/naming-conventions";

const QUERIES = {
    "getObjectUserRole": sql`SELECT role FROM object_user WHERE object_id = ? AND user_id = ?`.prepare(),

    "upsertObjectUser": sql`
INSERT INTO object_user ( object_id, user_id , role ) VALUES ( ?, ?, ? )
ON CONFLICT ( object_id, user_id  ) DO UPDATE SET role = ?
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

class ObjectRolesCache {
    #api;

    #cache;

    constructor ( api, size ) {
        this.#api = api;

        this.#cache = new CacheLru( {
            "maxSize": size,
        } );
    }

    // public
    get ( key ) {
        if ( this.#api.dbh.isConnected ) return;

        return this.#cache.get( key );
    }

    set ( key, value ) {
        if ( this.#api.dbh.isConnected ) return;

        return this.#cache.set( key, value );
    }

    update ( key, role ) {
        if ( this.#cache.has( key ) ) this.#cache.set( key, role );
    }

    delete ( key ) {
        this.#cache.delete( key );
    }

    clear () {
        this.#cache.clear();
    }
}

export default Super =>
    class extends ( Super || Object ) {
        #cache;
        #objects;

        // public
        // XXX cache
        async checkObjectPermissions ( objectId, objectResolverType, userId, methodId ) {
            const spec = this.#objects[objectResolverType];

            if ( !spec ) return;

            if ( spec.resolver ) {
                const res = await this.dbh.selectRow( spec.resolver, [objectId] );

                if ( !res.data?.id ) return;

                objectId = res.data.id;
            }

            const type = await this.getObjectType( objectId );

            if ( !type ) return;

            const role = await this.getObjectUserRole( objectId, userId );

            if ( !role ) return;

            return this.#objects[type]?.roles?.[role]?.permissions?.[methodId];
        }

        // XXX cache
        async getObjectType ( objectId ) {
            const res = await this.dbh.selectRow( sql`SELECT object_type.type FROM object_type, objects_registry WHERE objects_registry.object_type_id = object_type.id AND objects_registry.id = ?`, [objectId] );

            if ( !res.data?.type ) return;

            return res.data.type;
        }

        async getObjectUserRole ( objectId, userId ) {
            const objectType = this.#getObjectType( objectId );
            if ( !this.#objects[objectType] ) return;

            const cacheKey = userId + "/" + objectId;

            var roleId = this.#cache.get( cacheKey );

            if ( roleId ) return roleId;

            const res = await this.dbh.selectRow( QUERIES.getObjectUserRole, [objectId, userId] );

            if ( !res.data ) return;

            roleId = res.data.role;

            // role is invalid
            if ( !this.#objects[objectType].roles[roleId] ) return;

            this.#cache.set( cacheKey, roleId );

            return roleId;
        }

        async setObjectUserRole ( objectId, userId, roleId, options ) {
            const objectType = this.#getObjectType( objectId );
            if ( !this.#objects[objectType] ) return result( [400, `Object type in invalid`] );

            if ( !this.#objects[objectType].roles[roleId] ) return result( [400, `Role is invalid`] );

            return ( options?.dbh || this.dbh ).do( QUERIES.upsertObjectUser, [objectId, userId, roleId, roleId] );
        }

        async deleteObjectUser ( objectId, userId, options ) {
            return ( options?.dbh || this.dbh ).do( QUERIES.deleteObjectUser, [objectId, userId] );
        }

        // XXX
        async getObjectUsers ( objectId ) {
            const objectType = this.#getObjectType( objectId );
            if ( !this.#objects[objectType] ) return result( [400, `Object type in invalid`] );

            const res = await this.dbh.select( QUERIES.getObjectsUsers, ["?d=" + this.app.config.defaultGravatarImage, this.app.config.defaultGravatarUrl, objectId] );

            if ( res.data ) {
                const roles = this.#objects[objectType].roles;

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

        // XXX
        getObjectRoles ( objectId ) {
            const objectType = this.#getObjectType( objectId );
            if ( !this.#objects[objectType] ) return result( [400, `Object type in invalid`] );

            return result( 200, Object.values( this.#objects[objectType].roles ) );
        }

        // protected
        async _init ( options ) {
            this.#cache = new ObjectRolesCache( this, this.app.config.objectUserCacheMaxSize );

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
        async #init ( _objects ) {
            const types = [];

            for ( const [type, spec] of Object.entries( _objects ) ) {
                if ( !spec.resolver ) {
                    types.push( { type } );
                }
            }

            if ( types.length ) {
                const res = await this.dbh.do( sql`INSERT INTO object_type`.VALUES( types ).sql`ON CONFLICT ( type ) DO UPDATE SET type = EXCLUDED.type` );

                if ( !res.ok ) return res;
            }

            this.#objects = _objects;

            return result( 200 );
        }

        // XXX
        async #init1 ( _objects ) {
            const objects = {},
                objectIds = new Set();

            // validate config
            for ( const type in _objects ) {
                if ( !isSnakeCase( type ) ) return result( [500, `Object type "${type}" must be in the snake_case`] );

                const object = _objects[type];

                const objectId = parseInt( object.id );

                if ( isNaN( objectId ) || objectId < 0 || objectId > 255 ) return result( [500, `Object id for type "${type}" is invalid`] );
                if ( objectIds.has( objectId ) ) return result( [500, `Object id for type "${type}" is not unique`] );

                objectIds.add( objectId );

                if ( !object.roles ) return result( [500, `Object type "${type}" has no roles`] );

                objects[objectId] = {
                    type,
                    "canEditRoles": new Set(),
                    "roles": {},
                };

                for ( const roleId in object.roles ) {
                    const role = object.roles[roleId];

                    if ( !isSnakeCase( roleId ) ) return result( [500, `Object role "${roleId}" for object type "${type}" must be in the snake_case`] );
                    if ( !role.name ) return result( [500, `Object role "${roleId}" for object type "${type}" has no name`] );
                    if ( !role.description ) return result( [500, `Object role "${roleId}" for object type "${type}" has no description`] );

                    if ( role.canEditRoles ) objects[objectId].canEditRoles.add( roleId );

                    objects[objectId].roles[roleId] = {
                        "id": roleId,
                        "name": role.name,
                        "description": role.description,
                    };
                }

                if ( !objects[objectId].canEditRoles.size ) return result( [500, `Object type "${type}" has no roles with edit roles permission`] );
            }

            this.#objects = objects;

            // setup dbh events
            this.dbh.on( "api/object-user/update", data => this.#cache.update( data.user_id + "/" + data.object_id, data.role ) );
            this.dbh.on( "api/object-user/delete", data => this.#cache.delete( data.user_id + "/" + data.object_id ) );

            await this.dbh.waitConnect();

            this.dbh.on( "disconnect", () => this.#cache.clear() );

            return result( 200 );
        }

        // XXX remove
        #getObjectType ( objectId ) {
            return Number( BigInt( objectId ) >> 55n );
        }
    };
