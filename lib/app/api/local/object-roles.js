import sql from "#lib/sql";
import CacheLru from "#lib/cache-lru";
import { isSnakeCase } from "#lib/utils/naming-conventions";

const DEFAULT_CACHE_MAX_SIZE = 10000;

const QUERIES = {
    "getObjectRole": sql`SELECT role FROM object_role WERE user_id = ? AND object_id = ?`.prepare(),

    "upsertRole": sql`
INSERT INTO object_role ( user_id, object_id, role ) VALUES ( ?, ?, ? )
ON CONFLICT ( user_id, object_id ) DO UPDATE SET role = ?
`.prepare(),

    "deleteRole": sql`DELETE FROM object_role WHERE user_id = ? AND object_id = ?`.prepare(),

    "getObjectsUsers": sql`
SELECT
    object_role.user_id,
    "user".name AS username,
    object_role.role
FROM object_role, "user"
WHERE object_role.user_id = "user".id AND object.object_id = ?
`.prepare(),
};

class ObjectRolesCache {
    #api;
    #size;

    #cache;

    constructor ( api, size ) {
        this.#api = api;
        this.#size = size;

        this.#cache = new CacheLru( {
            "maxSize": this.#size,
        } );
    }

    // public
    get ( key ) {
        if ( this.#api.dbh.isReady ) return;

        return this.#cache.get( key );
    }

    set ( key, value ) {
        if ( this.#api.dbh.isReady ) return;

        return this.#cache.set( key, value );
    }

    update ( key, role ) {
        if ( this.#cache.has( key ) ) this.#cache.set( key, role );
    }

    delete ( key ) {
        this.#cache.delete( key );
    }

    reset () {
        this.#cache.reset();
    }
}

export default Super =>
    class extends ( Super || Object ) {
        #cache;
        #roles;

        // public
        async getObjectRole ( objectType, objectId, userId ) {
            if ( !this.#roles[objectType] ) return;

            const cacheKey = userId + "/" + objectId;

            const role = this.#cache.get( cacheKey );

            if ( role ) return role;

            const res = await this.dbh.selectRow( QUERIES.getObjectRole, [userId, objectId] );

            if ( !res.data ) return;
            if ( !this.#roles[objectType][res.data.role] ) return;

            this.#cache.set( cacheKey, res.data.role );

            return res.data.role;
        }

        async setObjectRole ( objectType, objectId, userId, role ) {
            if ( !this.#roles[objectType] ) return result( [400, `Object type in invalid`] );
            if ( !this.#roles[objectType][role] ) return result( [400, `Role in invalid`] );

            return this.dbh.do( QUERIES.upsertRole, [userId, objectId, role, role] );
        }

        async deleteObjectRole ( objectId, userId ) {
            return this.dbh.do( QUERIES.deleteRole, [userId, objectId] );
        }

        async getObjectUsers ( objectType, objectId ) {
            if ( !this.#roles[objectType] ) return result( [400, `Object type in invalid`] );

            const res = await this.dbh.select( QUERIES.getObjectsUsers, [objectId] );

            if ( res.data ) {
                res.data = res.data
                    .filter( row => this.#roles[objectType][row.role] )
                    .map( row => {
                        row.role_name = this.#roles[objectType][row.role].name;
                        row.role_description = this.#roles[objectType][row.role].decription;

                        return row;
                    } );
            }

            return res;
        }

        getObjectRoles ( objectType ) {
            if ( !this.#roles[objectType] ) return result( [400, `Object type in invalid`] );

            return result( 200, Object.values( this.#roles[objectType] ) );
        }

        // protected
        async _new ( options ) {
            this.#cache = new ObjectRolesCache( this, DEFAULT_CACHE_MAX_SIZE );

            var res;

            if ( this.app.settings.objectRoles ) {
                process.stdout.write( "Loading object roles ... " );
                res = await this.#init( this.app.settings.objectRoles );
                console.log( res + "" );

                if ( !res.ok ) return res;
            }

            res = super._new ? await super._new( options ) : result( 200 );

            return res;
        }

        // private
        async #init ( objectRoles ) {
            const roles = {};

            // validate config
            for ( const type in objectRoles ) {
                if ( !isSnakeCase( type ) ) return result( [500, `Object type "${type}" must be in the snake_case`] );

                roles[type] = {};

                for ( const role in objectRoles[type] ) {
                    if ( !isSnakeCase( role ) ) return result( [500, `Object role "${role}" for type "${type}" must be in the snake_case`] );
                    if ( !objectRoles[type][role].name ) return result( [500, `Object role "${role}" for type "${type}" has no name`] );
                    if ( !objectRoles[type][role].description ) return result( [500, `Object role "${role}" for type "${type}" has no description`] );

                    roles[type][role] = { ...objectRoles[type][role], "id": role };
                }
            }

            this.#roles = roles;

            // setup dbh events
            this.dbh.on( "event/api/object-role/update", data => this.#cache.update( data.user_id + "/" + data.object_id, data.role ) );
            this.dbh.on( "event/api/object-role/delete", data => this.#cache.delete( data.user_id + "/" + data.object_id ) );

            await this.dbh.waitReady();

            this.dbh.on( "disconnect", () => this.#cache.reset() );

            return result( 200 );
        }
    };
