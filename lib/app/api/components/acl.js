import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import { isKebabCase, isKebabCasePath } from "#lib/utils/naming-conventions";
import Mutex from "#lib/threads/mutex";
import constants from "#lib/app/constants";

const DEFAULT_ACL_TYPE = "default",
    DEFAULT_ACL_ID = -1,
    STATIC_PERMISSIONS = new Set( ["guest", "user", "root"] );

const QUERIES = {
    "getAclType": sql`SELECT acl_type.type FROM acl_type, acl WHERE acl.acl_type_id = acl_type.id AND acl.id = ?`.prepare(),

    "getAclUser": sql`
SELECT
    acl_type.type,
    acl_user.enabled,
    (
        SELECT
            json_agg( acl_scope.scope )
        FROM
            acl_scope,
            acl_user_scope
        WHERE
            acl_user_scope.acl_id = acl_user.acl_id
            AND acl_user_scope.user_id = acl_user.user_id
            AND acl_user_scope.acl_scope_id = acl_scope.id
            AND acl_scope.enabled
    ) AS scopes
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

    "deleteUser": sql`DELETE FROM acl_user WHERE acl_id = ? AND user_id = ?`.prepare(),

    "setUserEnabled": sql`UPDATE acl_user SET enabled = ? WHERE acl_id = ? AND user_id = ?`.prepare(),

    // XXX
    "getUsers": sql`
SELECT
    acl_user.user_id AS id,
    "user".email AS email,
    acl_user.enabled AS enabled,
    (
        SELECT
            json_agg( acl_scope.scope )
        FROM
            acl_scope,
            acl_user_scope
        WHERE
            acl_user_scope.acl_id = acl_user.acl_id
            AND acl_user_scope.user_id = acl_user.user_id
            AND acl_user_scope.acl_scope_id = acl_scope.id
    ) AS scopes,
    acl_permissions( acl_user.acl_id, ? ) AS editor_acl_permissions,
    'https://s.gravatar.com/avatar/' || "user".gravatar || ? AS avatar
FROM
    acl_user,
    "user"
WHERE
    acl_user.acl_id = ?
    AND acl_user.user_id = "user".id
`.prepare(),

    "suggestAclUsers": sql`
SELECT
    id,
    email,
    'https://s.gravatar.com/avatar/' || "user".gravatar || ? AS avatar
FROM
    "user"
WHERE
    "user".email ILIKE ?
    AND "user".id != ?
    AND "user".id NOT IN ( SELECT user_id FROM acl_user WHERE acl_id = ? )
LIMIT
    20
`,
};

export default class extends Component {
    #types = {};
    #resolvers = {};
    #mutexSet = new Mutex.Set( { "destroyOnFinish": true } );
    #aclIdCache;
    #aclObjectIdCache;
    #aclUserUserCache;

    // properties
    get staticPermissions () {
        return STATIC_PERMISSIONS;
    }

    // public
    async checkAclPermission ( userId, permission, aclResolvers ) {
        if ( this.api.validate.userIsRoot( userId ) ) return true;

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
            aclIds.add( DEFAULT_ACL_ID );
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

    async addAclUser ( aclId, userId, { enabled = true, scopes, parentUserId, dbh } = {} ) {
        var res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        // check parent user
        if ( parentUserId && !this.api.validate.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        res = await dbh.begin( async dbh => {
            var res;

            res = dbh.do( sql`INSERT INTO acl_user ( acl_id, user_id, enabled ) VALUES ( ?, ?, ? ) ON CONFLICT ( acl_id, user_id ) DO NOTHING`, [aclId, userId, enabled] );

            if ( !res.ok ) throw res;

            if ( !res.meta.rows ) throw `Unable to add user`;

            if ( scopes ) {
                res = await this.#setAclUserScopes( aclId, userId, scopes, { parentUserId, dbh } );

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
        if ( parentUserId && !this.api.validate.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        res = await dbh.do( QUERIES.deleteUser, [aclId, userId] );

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
        if ( parentUserId && !this.api.validate.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        res = await dbh.do( QUERIES.setUserEnabled, [enabled, aclId, userId] );

        if ( res.meta.rows ) {

            // drop cache
            const cacheId = aclId + "/" + userId;
            if ( this.#aclUserUserCache.has( cacheId ) ) this.#aclUserUserCache.get( cacheId ).enabled = enabled;
        }

        return res;
    }

    async setAclUserScopes ( aclId, userId, scopes, { parentUserId, dbh } = {} ) {
        const res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        const user = await this.#getAclUser( aclId, userId, { dbh } );

        if ( user === false ) {
            return result( [400, `Unable to add ACL user scopes`] );
        }
        else if ( !user ) {
            return this.addAclUser( aclId, userId, { scopes, parentUserId, dbh } );
        }
        else {
            return this.#setAclUserScopes( aclId, userId, scopes, { parentUserId, dbh } );
        }
    }

    async addAclUserScopes ( aclId, userId, scopes, { parentUserId, dbh } = {} ) {
        var res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        const user = await this.#getAclUser( aclId, userId, { dbh } );

        if ( user === false ) {
            return result( [400, `Unable to add ACL user scopes`] );
        }
        else if ( !user ) {
            return this.addAclUser( aclId, userId, { scopes, parentUserId, dbh } );
        }

        const aclType = user.type;

        // check parent user
        if ( parentUserId && !this.api.validate.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        if ( !scopes ) {
            scopes = [];
        }
        else if ( !Array.isArray( scopes ) ) {
            scopes = [scopes];
        }

        scopes = new Set( scopes );

        const addScopes = [];

        for ( const scope of scopes ) {
            if ( !this.#types[aclType].scopes[scope] ) return result( [400, `ACL scopes are invalid`] );

            if ( parentUser && !parentUser.scopes.has( scope ) ) return result( [400, `ACL scopes are invalid`] );

            if ( !user.scopes.has( scope ) ) addScopes.push( scope );
        }

        if ( !addScopes.length ) return result( 200 );

        res = await dbh.do( sql`INSERT INTO acl_user_scope`.VALUES( addScopes.map( scope => {
            return {
                "acl_id": aclId,
                "user_id": userId,
                "acl_scope_id": sql`SELECT acl_scope.id FROM acl_scope, acl_type WHERE acl_scope.acl_type_id = acl_type.id AND acl_type.type = ${aclType} AND acl_scope.scope = ${scope}`,
            };
        } ) ) );

        return res;
    }

    async deleteAclUserScopes ( aclId, userId, scopes, { parentUserId, dbh } = {} ) {
        var res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        const user = await this.#getAclUser( aclId, userId, { dbh } );

        if ( !user ) {
            return result( [400, `Unable to delete ACL user scopes`] );
        }

        const aclType = user.type;

        // check parent user
        if ( parentUserId && !this.api.validate.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        if ( !scopes ) {
            scopes = [];
        }
        else if ( !Array.isArray( scopes ) ) {
            scopes = [scopes];
        }

        scopes = new Set( scopes );

        const deleteScopes = [];

        for ( const scope of scopes ) {
            if ( !this.#types[aclType].scopes[scope] ) return result( [400, `ACL scopes are invalid`] );

            if ( parentUser && !parentUser.scopes.has( scope ) ) return result( [400, `ACL scopes are invalid`] );

            if ( user.scopes.has( scope ) ) deleteScopes.push( scope );
        }

        if ( !deleteScopes.length ) return result( 200 );

        res = await dbh.do( sql`
DELETE FROM
    acl_user_scope
WHERE
    acl_id = ${aclId}
    AND user_id = ${userId}
    AND acl_scope_id IN (
        SELECT
            acl_scope.id
        FROM
            acl_scope,
            acl_type
        WHERE
            acl_scope.acl_type_id = acl_type.id
            AND acl_type.type = ${aclType}
            AND acl_scope.scope`.IN( deleteScopes ).sql`
    )
` );

        return res;
    }

    // XXX
    async readAclUsers () {}

    async suggestAclUsers ( aclId, query ) {
        query = query ? `%${query}%` : "%";

        return this.dbh.select( QUERIES.suggestAclUsers, [

            //
            "?d=" + this.api.config.defaultGravatarEncoded,
            query,
            constants.rootUserId,
            aclId,
        ] );
    }

    async getAclUserScopes ( aclId, userId, { parentUserId } = {} ) {
        const userIsRoot = this.api.validate.userIsRoot( userId );

        var user, parentUser;

        // get parent user
        if ( parentUserId && !this.api.validate.userIsRoot( parentUserId ) ) {
            parentUser = await this.#getAclUser( aclId, parentUserId );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get ACL scopes`] );
        }

        // get user
        if ( userId && !userIsRoot ) {
            user = await this.#getAclUser( aclId, userId );

            if ( user === false ) return result( [400, `Unable to get ACL scopes`] );
        }

        // get acl type
        const aclType = user?.type || parentUser?.type || ( await this.#getAclType( aclId ) );
        if ( !aclType ) return result( [400, `ACL id is invalid`] );

        const scopes = [];

        for ( const scope of Object.values( this.#types[aclType].scopes ) ) {
            let readonly;

            if ( userIsRoot ) {
                readonly = true;
            }
            else if ( userId === parentUserId ) {
                readonly = true;
            }
            else if ( parentUser ) {
                readonly = !parentUser.scopes.has( scope.scope );
            }
            else {
                readonly = false;
            }

            scopes.push( {
                "id": scope.scope,
                "name": scope.name,
                "description": scope.description,
                "enabled": userIsRoot ? true : user ? user.scopes.has( scope.scope ) : false,
                readonly,
            } );
        }

        return result( 200, scopes );
    }

    // protected
    async _init () {
        this.#aclIdCache = new CacheLru( { "maxSize": this.api.config.aclCacheMaxSize } );
        this.#aclUserUserCache = new CacheLru( { "maxSize": this.api.config.aclCacheMaxSize } );
        this.#aclObjectIdCache = new CacheLru( { "maxSize": this.api.config.aclCacheMaxSize } );

        return result( 200 );
    }

    async _postInit ( acl ) {
        if ( !this.api.config.acl ) return result( 200 );

        // default ACL is required
        if ( !this.api.config.acl[DEFAULT_ACL_TYPE] ) {
            return result( [400, `Default ACL is required`] );
        }

        const allPermissions = new Set(),
            unusedPermissions = new Set();

        // check api schema permissions, create permissions index
        {
            for ( const method of Object.values( this.api.frontend.schema.methods ) ) {
                if ( !method.permission ) continue;

                // statuc permission
                if ( STATIC_PERMISSIONS.has( method.permission ) ) continue;

                // validate permission name
                const [namespace, name] = method.permission.split( ":" );
                if ( !isKebabCasePath( namespace ) || !isKebabCasePath( name ) ) return result( [500, `Permission "${method.permission}" is invalid`] );

                allPermissions.add( method.permission );
                unusedPermissions.add( method.permission );
            }
        }

        // acl types
        {
            for ( const [aclType, scopes] of Object.entries( this.api.config.acl ) ) {

                // type id must be in kebab-case
                if ( !isKebabCase( aclType ) ) return result( [500, `ACL type "${aclType}" must be in the kebab-case`] );

                // ACL type is already registered
                if ( this.#types[aclType] ) return result( [500, `ACL type "${aclType}" is already registered`] );

                // scopes
                for ( const [scope, scopeSpec] of Object.entries( scopes ) ) {

                    // scope id must be in kebab-case
                    if ( !isKebabCase( scope ) ) return result( [500, `ACL scope "${scope}" must be in the kebab-case`] );

                    scopeSpec.scope = scope;

                    // check obsolete permissions
                    for ( const permission of scopeSpec.permissions ) {

                        // scope has unknown permission
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

        // acl resolvers
        {
            for ( const [aclResolver, query] of Object.entries( this.api.frontend.schema.aclResolvers ) ) {
                this.#resolvers[aclResolver] = query ? sql( query ).prepare() : null;
            }
        }

        // check api methods acl object types
        {
            for ( const method of Object.values( this.api.frontend.schema.methods ) ) {
                if ( !method.aclResolvers ) continue;

                for ( const aclResolver of method.aclResolvers ) {
                    if ( !( aclResolver in this.#resolvers ) ) {
                        return result( [500, `ACL object type "${aclResolver}" is not registered`] );
                    }
                }
            }
        }

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
                    index[row.type].type = row.type;
                    index[row.type].id = row.type_id;
                    index[row.type].enabled = row.type_enabled;

                    index[row.type].scopes ??= {};
                    index[row.type].scopes[row.scope] ??= {};
                    index[row.type].scopes[row.scope].scope = row.scope;
                    index[row.type].scopes[row.scope].id = row.scope_id;
                    index[row.type].scopes[row.scope].enabled = row.scope_enabled;

                    index[row.type].scopes[row.scope].permissions ??= [];
                    index[row.type].scopes[row.scope].permissions.push( row.permission );
                }
            }

            // scan for deleted types
            for ( const type of Object.values( index ) ) {

                // acl type was deleted
                if ( !this.#types[type.type] && type.enabled ) {

                    // disable acl type
                    res = await dbh.do( sql`UPDATE acl_type SET enabled = FALSE WHERE id = ?`, [type.id] );
                    if ( !res.ok ) throw res;

                    type.enabled = false;
                }
            }

            // sync types
            for ( const type of Object.values( this.#types ) ) {

                // add acl type
                if ( !index[type.type] ) {
                    res = await dbh.selectRow( sql`INSERT INTO acl_type ( id, type ) VALUES ( ?, ? ) RETURNING id`, [type.type === DEFAULT_ACL_TYPE ? DEFAULT_ACL_ID : null, type.type] );
                    if ( !res.ok ) throw res;

                    index[type.type] = {
                        "id": res.data.id,
                        "enabled": true,
                        "scopes": {},
                    };
                }

                // enable acl type
                else if ( !index[type.type].enabled ) {
                    res = await dbh.do( sql`UPDATE acl_type SET enabled = TRUE WHERE id = ?`, [index[type.type].id] );
                    if ( !res.ok ) throw res;

                    index[type.type].enabled = true;
                }

                // scan for deleted scopes
                for ( const scope of Object.values( index[type.type].scopes ) ) {

                    // scope was deleted
                    if ( !type.scopes[scope.scope] && scope.enabled ) {

                        // disable acl scope
                        res = await dbh.do( sql`UPDATE acl_scope SET enabled = FALSE WHERE id = ?`, [scope.id] );
                        if ( !res.ok ) throw res;

                        scope.enabled = false;
                    }
                }

                // sync scopes
                for ( const scope of Object.values( type.scopes ) ) {

                    // add acl scope
                    if ( !index[type.type].scopes[scope.scope] ) {
                        res = await dbh.selectRow( sql`INSERT INTO acl_scope ( acl_type_id, scope ) VALUES ( ?, ? ) RETURNING id`, [index[type.type].id, scope.scope] );
                        if ( !res.ok ) throw res;

                        index[type.type].scopes[scope.scope] = {
                            "id": res.data.id,
                            "enabled": true,
                            "permissions": [],
                        };
                    }

                    // enable acl scope
                    else if ( !index[type.type].scopes[scope.scope].enabled ) {
                        res = await dbh.do( sql`UPDATE acl_scope SET enabled = TRUE WHERE id = ?`, [index[type.type].scopes[scope.scope].id] );
                        if ( !res.ok ) throw res;

                        index[type.type].scopes[scope.scope].enabled = true;
                    }

                    // scan for deleted permissions
                    const deletedPermissions = [];

                    for ( const permission of index[type.type].scopes[scope.scope].permissions ) {
                        if ( !scope.permissions.includes( permission ) ) deletedPermissions.push( permission );
                    }

                    // delete permissions
                    if ( deletedPermissions.length ) {
                        res = await dbh.do( sql`DELETE FROM acl_permission WHERE acl_scope_id = ${index[type.type].scopes[scope.scope].id} AND permission`.IN( deletedPermissions ) );
                        if ( !res.ok ) throw res;
                    }

                    // scan for added permissions
                    const addedPermissions = [];

                    for ( const permission of scope.permissions ) {
                        if ( !index[type.type].scopes[scope.scope].permissions.includes( permission ) ) {
                            addedPermissions.push( {
                                "acl_scope_id": index[type.type].scopes[scope.scope].id,
                                permission,
                            } );
                        }
                    }

                    // add permissions
                    if ( addedPermissions.length ) {
                        res = await dbh.do( sql`INSERT INTO acl_permission`.VALUES( addedPermissions ) );
                        if ( !res.ok ) throw res;
                    }
                }
            }

            // create default acl
            res = await dbh.do( sql`INSERT INTO acl ( id, acl_type_id ) VALUES ( ?, ? ) ON CONFLICT ( id ) DO NOTHING`, [DEFAULT_ACL_ID, DEFAULT_ACL_ID] );
            if ( !res.ok ) throw res;
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
    async #resolveAclId ( aclObjectId, aclResolver ) {
        const resolver = this.#resolvers[aclResolver];

        if ( !resolver ) return aclObjectId;

        const cacheId = `${aclResolver}/${aclObjectId}`;

        var aclId = this.#aclObjectIdCache.get( cacheId );

        if ( aclId ) return aclId;

        const mutex = this.#mutexSet.get( `resolve/${cacheId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

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

        mutex.signal.broadcast( aclId );
        mutex.up();

        return aclId;
    }

    async #getAclType ( aclId, { dbh } = {} ) {
        var aclType = this.#aclIdCache.get( aclId );

        if ( aclType ) return aclType;

        const mutex = this.#mutexSet.get( `type/${aclId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getAclType, [aclId] );

        if ( !res.ok ) {
            aclType = false;
        }
        else if ( res.data ) {
            aclType = res.data.type;

            if ( this.#types[aclType] ) {
                this.#aclIdCache.set( aclId, aclType );
            }
        }
        else {
            aclType = null;
        }

        mutex.signal.broadcast( aclType );
        mutex.up();

        return aclType;
    }

    async #getAclUser ( aclId, userId, { dbh } = {} ) {
        const cacheId = aclId + "/" + userId;

        var user = this.#aclUserUserCache.get( cacheId );

        if ( user ) return user;

        const mutex = this.#mutexSet.get( `user/${cacheId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( QUERIES.getAclUser, [aclId, userId] );

        if ( !res.ok ) {
            user = false;
        }
        else if ( res.data ) {
            user = res.data;

            user.scopes = new Set( user.scopes );

            user.permissions = new Set();

            for ( const scope of user.scopes ) {
                for ( const permission of this.#types[user.type].scopes[scope].permissions ) {
                    user.permissions.add( permission );
                }
            }

            this.#aclUserUserCache.set( cacheId, user );
        }
        else {
            user = null;
        }

        mutex.signal.broadcast( user );
        mutex.up();

        return user;
    }

    async #setAclUserScopes ( aclId, userId, scopes, { parentUserId, dbh } = {} ) {
        var res = this.#validateUser( userId, parentUserId );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        const user = await this.#getAclUser( aclId, userId, { dbh } );

        if ( !user ) {
            return result( [400, `Unable to delete ACL user scopes`] );
        }

        const aclType = user.type;

        // check parent user
        if ( parentUserId && !this.api.validate.userIsRoot( parentUserId ) ) {
            var parentUser = await this.#getAclUser( aclId, parentUserId, { dbh } );
            if ( !parentUser?.enabled ) return result( [400, `Unable to get parnet user`] );
        }

        if ( !scopes ) {
            scopes = [];
        }
        else if ( !Array.isArray( scopes ) ) {
            scopes = [scopes];
        }

        scopes = new Set( scopes );

        const addScopes = [],
            deleteScopes = [];

        for ( const scope of scopes ) {
            if ( !this.#types[aclType].scopes[scope] ) return result( [400, `ACL scopes are invalid`] );

            if ( parentUser && !parentUser.scopes.has( scope ) ) return result( [400, `ACL scopes are invalid`] );

            if ( !user.scopes.has( scope ) ) addScopes.push( scope );
        }

        for ( const scope of user.scopes ) {
            if ( parentUser && !parentUser.scopes.has( scope ) ) return result( [400, `ACL scopes are invalid`] );

            if ( !scopes.has( scope ) ) deleteScopes.push( scope );
        }

        if ( !addScopes.length && !deleteScopes.length ) return result( 200 );

        res = await dbh.begin( async dbh => {
            var res;

            if ( addScopes.length ) {
                res = await dbh.do( sql`INSERT INTO acl_user_scope`.VALUES( addScopes.map( scope => {
                    return {
                        "acl_id": aclId,
                        "user_id": userId,
                        "acl_scope_id": sql`SELECT acl_scope.id FROM acl_scope, acl_type WHERE acl_scope.acl_type_id = acl_type.id AND acl_type.type = ${aclType} AND acl_scope.scope = ${scope}`,
                    };
                } ) ) );

                if ( !res.ok ) throw res;
            }

            if ( deleteScopes.length ) {
                res = await dbh.do( sql`
DELETE FROM
    acl_user_scope
WHERE
    acl_id = ${aclId}
    AND user_id = ${userId}
    AND acl_scope_id IN (
        SELECT
            acl_scope.id
        FROM
            acl_scope,
            acl_type
        WHERE
            acl_scope.acl_type_id = acl_type.id
            AND acl_type.type = ${aclType}
            AND acl_scope.scope`.IN( deleteScopes ).sql`
    )
` );

                if ( !res.ok ) throw res;
            }
        } );

        return res;
    }

    #validateUser ( userId, parentUserId ) {
        if ( this.api.validate.userIsRoot( userId ) ) return result( [400, `Unable to add root user`] );

        if ( userId === parentUserId ) return result( [400, `Unable to add user`] );

        return result( 200 );
    }
}
