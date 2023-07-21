import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import constants from "#lib/app/constants";
import Counter from "#lib/threads/counter";

const SUGGEST_ACL_USERS_LIMIT = 20;

const SQL = {
    "loadTypes": sql`
SELECT
    json_object_agg(
        type, json_build_object(
            'type', type,
            'id', id,
            'enabled', enabled,
            'roles', (
                SELECT
                    json_object_agg(
                        role, json_build_object(
                            'role', role,
                            'id', id,
                            'enabled', enabled,
                            'name', name,
                            'description', description,
                            'permissions', ( SELECT json_agg( permission ) FROM acl_permission WHERE acl_role_id = acl_role.id )
                        )
                    )
                FROM
                    acl_role
                WHERE
                    acl_type.id = acl_role.acl_type_id
            ),
            'notifications', (
                SELECT
                    json_object_agg(
                        notification, json_build_object(
                            'notification', notification,
                            'id', id,
                            'enabled', enabled,
                            'name', name,
                            'description', description,
                            'roles', roles,
                            'channels', channels
                        )
                    )
                FROM
                    acl_notification
                WHERE
                    acl_type.id = acl_notification.acl_type_id
            )
        )
    ) AS acl
FROM
    acl_type
`,

    "getAclType": sql`SELECT acl_type.type FROM acl_type, acl WHERE acl.acl_type_id = acl_type.id AND acl.id = ?`.prepare(),

    "addAclUser": sql`INSERT INTO acl_user ( acl_id, user_id, enabled ) VALUES ( ?, ?, ? ) ON CONFLICT ( acl_id, user_id ) DO NOTHING`.prepare(),

    "getAclUser": sql`
SELECT
    acl_type.id AS acl_type_id,
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

    "getAclUserNotifications": sql`
SELECT
    json_object_agg(
        acl_notification.notification, json_build_object(
            'internal', acl_user_notification.internal,
            'email', acl_user_notification.email,
            'telegram', acl_user_notification.telegram,
            'push', acl_user_notification.push
        )
    ) AS notifications
FROM
    acl_notification,
    acl_user_notification
WHERE
    acl_user_notification.acl_id = ?
    AND acl_user_notification.user_id = ?
    AND acl_user_notification.acl_notification_id = acl_notification.id
`.prepare(),

    "setAclUserNotificationSubscribed": sql`
INSERT INTO
    acl_user_notification
( acl_id, user_id, acl_notification_id, internal, email, telegram, push )
VALUES ( ?, ?, ?, ?, ?, ?, ? )
ON CONFLICT ( acl_id, user_id, acl_notification_id ) DO UPDATE SET
    internal = EXCLUDED.internal,
    email = EXCLUDED.email,
    telegram = EXCLUDED.telegram,
    push = EXCLUDED.push
`.prepare(),

    "setChannelSubscribed": {
        "internal": sql`
INSERT INTO
    acl_user_notification
( acl_id, user_id, acl_notification_id, internal ) VALUES ( ?, ?, ?, ? )
ON CONFLICT ( acl_id, user_id, acl_notification_id ) DO UPDATE SET
    internal = EXCLUDED.internal
`.prepare(),

        "email": sql`
INSERT INTO
    acl_user_notification
( acl_id, user_id, acl_notification_id, email ) VALUES ( ?, ?, ?, ? )
ON CONFLICT ( acl_id, user_id, acl_notification_id ) DO UPDATE SET
    email = EXCLUDED.email
`.prepare(),

        "telegram": sql`
INSERT INTO
    acl_user_notification
( acl_id, user_id, acl_notification_id, telegram ) VALUES ( ?, ?, ?, ? )
ON CONFLICT ( acl_id, user_id, acl_notification_id ) DO UPDATE SET
    telegram = EXCLUDED.telegraml
`.prepare(),

        "push": sql`
INSERT INTO
    acl_user_notification
INSERT INTO
    acl_user_notification
( acl_id, user_id, acl_notification_id, push ) VALUES ( ?, ?, ?, ? )
ON CONFLICT ( acl_id, user_id, acl_notification_id ) DO UPDATE SET
    push = EXCLUDED.push
`.prepare(),
    },
};

export default class Acl {
    #app;
    #config;
    #types = {};
    #mutexSet = new Mutex.Set();

    #aclIdCache;
    #aclObjectIdCache;
    #aclUserUserCache;
    #aclTypeRolesCache = {};
    #activityCounter = new Counter();

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get dbh () {
        return this.#app.dbh;
    }

    get config () {
        return this.#config;
    }

    // public
    async configure () {
        for ( const component of this.app.components ) {
            if ( component.name === "acl" ) continue;

            const acl = await component.getAcl();

            if ( !acl ) continue;

            for ( const [type, typeSpec] of Object.entries( acl ) ) {
                if ( this.#config.types[type] ) {
                    return result( [400, `ACL "${type}" is already defined`] );
                }

                this.#config.types[type] = typeSpec;
            }
        }

        return result( 200 );
    }

    async init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async start () {
        const res = await this.#loadTypes();
        if ( !res.ok ) return res;

        this.#aclIdCache = new CacheLru( { "maxSize": this.config.cacheMaxSize } );
        this.#aclUserUserCache = new CacheLru( { "maxSize": this.config.cacheMaxSize } );
        this.#aclObjectIdCache = new CacheLru( { "maxSize": this.config.cacheMaxSize } );

        // setup dbh events
        this.dbh.on( "acl/type/update", () => {
            this.#aclIdCache.clear();
            this.#aclIdCache.clear();
            this.#aclObjectIdCache.clear();
            this.#aclTypeRolesCache = {};

            this.#loadTypes();
        } );

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

    async shutDown () {
        return this.#activityCounter.wait();
    }

    async updateTypes ( types ) {
        var res;

        // sync data
        res = await this.dbh.begin( async dbh => {
            var res, updated;

            // set transaction level lock
            res = await dbh.selectRow( sql`SELECT pg_advisory_xact_lock( ${dbh.schema.getLockId( "acl/sync" )} )` );
            if ( !res.ok ) throw res;

            res = await dbh.selectRow( SQL.loadTypes );
            if ( !res.ok ) throw res;

            const index = res.data?.acl || {};

            // delete types
            {
                const deletedTypes = [];

                // search for deleted types
                for ( const type of Object.values( index ) ) {
                    if ( !types[type.type] && type.enabled ) deletedTypes.push( type.id );
                }

                // disable types
                if ( deletedTypes.length ) {
                    res = await dbh.do( sql`UPDATE acl_type SET enabled = FALSE WHERE id`.IN( deletedTypes ) );
                    if ( !res.ok ) throw res;

                    // disable roles
                    res = await dbh.do( sql`UPDATE acl_role SET enabled = FALSE WHERE acl_type_id`.IN( deletedTypes ) );
                    if ( !res.ok ) throw res;

                    // delete permissions
                    res = await dbh.do( sql`DELETE FROM acl_permission USING acl_role WHERE acl_permission.acl_role_id = acl_role.id AND acl_role.acl_type_id`.IN( deletedTypes ) );
                    if ( !res.ok ) throw res;

                    // disable notifications
                    res = await dbh.do( sql`UPDATE acl_notification SET enabled = FALSE WHERE acl_type_id`.IN( deletedTypes ) );
                    if ( !res.ok ) throw res;

                    updated = true;
                }
            }

            // sync types
            for ( const type of Object.values( types ) ) {

                // add type
                if ( !index[type.type] ) {

                    // default type
                    if ( type.type === constants.defaultAclType ) {
                        res = await dbh.selectRow( sql`INSERT INTO acl_type ( id, type ) VALUES ( ?, ? ) RETURNING id`, [

                            //
                            constants.defaultAclId,
                            type.type,
                        ] );
                    }
                    else {
                        res = await dbh.selectRow( sql`INSERT INTO acl_type ( type ) VALUES ( ? ) RETURNING id`, [

                            //
                            type.type,
                        ] );
                    }

                    if ( !res.ok ) throw res;

                    updated = true;
                    index[type.type] = {
                        "id": res.data.id,
                        "enabled": true,
                        "roles": {},
                    };
                }

                // enable type
                else if ( !index[type.type].enabled ) {
                    res = await dbh.do( sql`UPDATE acl_type SET enabled = TRUE WHERE id = ?`, [index[type.type].id] );
                    if ( !res.ok ) throw res;

                    updated = true;
                    index[type.type].enabled = true;
                }

                // roles
                {

                    // search for deleted roles
                    const deletedRoles = [];

                    for ( const role of Object.values( index[type.type].roles ) ) {
                        if ( !type.roles[role.role] ) deletedRoles.push( role.id );
                    }

                    // delete roles
                    if ( deletedRoles.length ) {
                        res = await dbh.do( sql`UPDATE acl_role SET enabled = FALSE WHERE id`.IN( deletedRoles ) );
                        if ( !res.ok ) throw res;

                        // delete permissions
                        res = await dbh.do( sql`DELETE FROM acl_permissions WHERE acl_role_id`.IN( deletedRoles ) );
                        if ( !res.ok ) throw res;
                    }

                    // sync roles
                    for ( const role of Object.values( type.roles ) ) {
                        const indexedRole = index[type.type].roles[role.role];

                        // add role
                        if ( !indexedRole ) {
                            res = await dbh.selectRow( sql`INSERT INTO acl_role ( acl_type_id, role, name, description ) VALUES ( ?, ?, ?, ? ) RETURNING id`, [index[type.type].id, role.role, role.name, role.description] );
                            if ( !res.ok ) throw res;

                            updated = true;
                            index[type.type].roles[role.role] = {
                                "id": res.data.id,
                                "enabled": true,
                                "permissions": [],
                            };
                        }

                        // update role
                        else if ( !indexedRole.enabled || indexedRole.name !== role.name || indexedRole.description !== role.description ) {
                            res = await dbh.do( sql`UPDATE acl_role SET enabled = TRUE, name = ?, description = ? WHERE id = ?`, [

                                //
                                role.name,
                                role.description,
                                indexedRole.id,
                            ] );
                            if ( !res.ok ) throw res;

                            updated = true;
                            index[type.type].roles[role.role].enabled = true;
                        }

                        // permissions
                        {
                            const localPermissions = new Set( role.permissions ),
                                remotePermissions = new Set( index[type.type].roles[role.role].permissions );

                            // scan for deleted permissions
                            const deletedPermissions = [];

                            for ( const permission of remotePermissions ) {
                                if ( !localPermissions.has( permission ) ) deletedPermissions.push( permission );
                            }

                            // delete permissions
                            if ( deletedPermissions.length ) {
                                res = await dbh.do( sql`DELETE FROM acl_permission WHERE acl_role_id = ${index[type.type].roles[role.role].id} AND permission`.IN( deletedPermissions ) );
                                if ( !res.ok ) throw res;

                                updated = true;
                            }

                            // scan for added permissions
                            const addedPermissions = [];

                            for ( const permission of localPermissions ) {
                                if ( !remotePermissions.has( permission ) ) {
                                    addedPermissions.push( {
                                        "acl_role_id": index[type.type].roles[role.role].id,
                                        permission,
                                    } );
                                }
                            }

                            // add permissions
                            if ( addedPermissions.length ) {
                                res = await dbh.do( sql`INSERT INTO acl_permission`.VALUES( addedPermissions ) );
                                if ( !res.ok ) throw res;

                                updated = true;
                            }
                        }
                    }
                }

                // notifications
                {

                    // search for deleted notifications
                    if ( index[type.type].notifications ) {
                        const deletedNotifications = [];

                        for ( const notification of Object.values( index[type.type].notifications ) ) {
                            if ( !type.notifications?.[notification.notification] ) deletedNotifications.push( notification.id );
                        }

                        // delete notifications
                        if ( deletedNotifications.length ) {
                            res = await dbh.do( sql`UPDATE acl_notification SET enabled = FALSE WHERE id`.IN( deletedNotifications ) );
                            if ( !res.ok ) throw res;
                        }
                    }

                    // sync notifications
                    if ( type.notifications ) {
                        for ( const notification of Object.values( type.notifications ) ) {
                            const indexedNotification = index[type.type].notifications?.[notification.notification];

                            // add notification
                            if ( !indexedNotification ) {
                                res = await dbh.selectRow( sql`INSERT INTO acl_notification ( acl_type_id, notification, name, description, roles, channels ) VALUES ( ?, ?, ?, ?, ?, ? ) RETURNING id`, [

                                    //
                                    index[type.type].id,
                                    notification.notification,
                                    notification.name,
                                    notification.description,
                                    notification.roles,
                                    notification.channels,
                                ] );
                                if ( !res.ok ) throw res;

                                updated = true;
                            }

                            // update notification
                            else {
                                const localRoles = JSON.stringify( notification.roles ),
                                    remoteRoles = JSON.stringify( indexedNotification.roles );

                                const localChannels = JSON.stringify( notification.channels ),
                                    remoteChannels = JSON.stringify( indexedNotification.channels );

                                if ( !indexedNotification.enabled || indexedNotification.name !== notification.name || indexedNotification.description !== notification.description || localRoles !== remoteRoles || localChannels !== remoteChannels ) {
                                    res = await dbh.do( sql`UPDATE acl_notification SET enabled = TRUE, name = ?, description = ?, roles = ?, channels = ? WHERE id = ?`, [

                                        //
                                        notification.name,
                                        notification.description,
                                        notification.roles,
                                        notification.channels,
                                        indexedNotification.id,
                                    ] );
                                    if ( !res.ok ) throw res;

                                    updated = true;
                                }
                            }
                        }
                    }
                }
            }

            // create default acl
            res = await dbh.do( sql`INSERT INTO acl ( id, acl_type_id ) VALUES ( ?, ? ) ON CONFLICT ( id ) DO NOTHING`, [constants.defaultAclId, constants.defaultAclId] );
            if ( !res.ok ) throw res;

            if ( updated ) {
                res = await dbh.select( sql`SELECT pg_notify( ?, NULL )`, ["acl/type/update"] );
                if ( !res.ok ) throw res;
            }
        } );

        if ( !res.ok ) return res;

        return result( 200 );
    }

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
            if ( !this.#types[aclType].roles[role] ) return result( [400, `ACL roles are invalid`] );

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
            if ( !this.#types[aclType].roles[role] ) return result( [400, `ACL roles are invalid`] );

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

        for ( const role of Object.values( this.#types[aclType].roles ) ) {
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

                for ( const role of Object.values( this.#types[aclType].roles ) ) {
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

            for ( const role of Object.values( this.#types[aclType].roles ) ) {
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

    async sendNotification ( aclId, notificationType, subject, body ) {
        this.#activityCounter.value++;

        const res = await this.#sendNotification( aclId, notificationType, subject, body );

        this.#activityCounter.value--;

        return res;
    }

    async getAclUserNotificationsProfile ( aclId, userId ) {
        const user = await this.#getAclUser( aclId, userId );
        if ( !user ) return result( [500, `ACL user not found`] );

        const res = await this.dbh.select( SQL.getAclUserNotifications, [aclId, userId] );
        if ( !res.ok ) return res;

        const userNotifications = res.data?.notifications || {};

        const notifications = [];

        for ( const notification of Object.values( this.#types[user.aclType].notifications ) ) {
            ROLES: if ( notification.roles ) {
                for ( const role of notification.roles ) {
                    if ( user.roles.has( role ) ) break ROLES;
                }

                continue;
            }

            const notificationProfile = {
                "id": notification.notification,
                "name": notification.name,
                "description": notification.description,
                "channels": {},
            };

            notifications.push( notificationProfile );

            for ( const channel of Object.values( notification.channels ) ) {
                notificationProfile.channels[channel.channel] = {
                    "enabled": channel.enabled,
                    "editable": channel.editable,
                    "subscribed": channel.editable ? userNotifications[notification.notification]?.[channel.channel] ?? channel.subscribed : channel.subscribed,
                };
            }
        }

        return result( 200, notifications );
    }

    // XXX no notification / channel
    async setAclUserNotificationSubscribed ( { aclId, userId, notification, channel, subscribed } = {} ) {
        const user = await this.#getAclUser( aclId, userId );
        if ( !user ) return result( [500, `ACL user not found`] );

        if ( !notification ) {

            // channel is not valid or disabled
            if ( channel && !this.app.notifications.isChannelEnabled( channel ) ) return result( [400, `Notification channel is not valid`] );

            const values = [],
                set = {};

            for ( const notification of Object.values( this.#types[user.aclType]?.notifications ) ) {
                if ( channel ) {
                    values.push( {
                        "acl_id": aclId,
                        "user_id": userId,
                        "acl_notification_id": notification.id,
                        [channel]: subscribed,
                    } );
                }
                else {
                    values.push( {
                        "acl_id": aclId,
                        "user_id": userId,
                        "acl_notification_id": notification.id,
                        "internal": subscribed,
                        "email": subscribed,
                        "telegram": subscribed,
                        "pish": subscribed,
                    } );
                }
            }

            // no notifications
            if ( !values.length ) return result( 200 );

            if ( channel ) {
                set[channel] = sql`EXCLUDED.`.ID( channel );
            }
            else {
                set.internal = sql`EXCLUDED.internal`;
                set.email = sql`EXCLUDED.email`;
                set.telegram = sql`EXCLUDED.telegram`;
                set.push = sql`EXCLUDED.push`;
            }

            return this.dbh.do( sql`INSERT INTO acl_user_notification`.VALUES( values ).sql`ON CONFLICT ( userId, notification ) DO UPDATE`.SET( set ) );
        }
        else {
            notification = this.#types[user.aclType]?.notifications?.[notification];
            if ( !notification ) return result( [400, `Invalid ACL notification`] );

            if ( channel ) {
                if ( !notification.channels[channel] ) return result( [400, `Notification channel is not valid`] );

                if ( !notification.channels[channel].editable ) return result( [400, `ACL notification channel is read-only`] );

                return this.dbh.do( SQL.setChannelSubscribed[channel], [

                    //
                    aclId,
                    userId,
                    notification.id,
                    subscribed,
                ] );
            }
            else {
                return this.dbh.do( SQL.setAclUserNotificationSubscribed, [

                    //
                    aclId,
                    userId,
                    notification.id,
                    subscribed,
                    subscribed,
                    subscribed,
                    subscribed,
                ] );
            }
        }
    }

    // private
    async #loadTypes () {
        const res = await this.dbh.selectRow( SQL.loadTypes );
        if ( !res.ok ) throw res;

        const types = res.data?.acl || {};

        for ( const type of Object.values( types ) ) {
            if ( !type.enabled ) {
                delete types[type.type];
            }
            else {
                for ( const role of Object.values( type.roles ) ) {
                    if ( !role.enabled ) {
                        delete type.roles[role.role];
                    }
                }

                type.notifications ||= {};

                for ( const notification of Object.values( type.notifications ) ) {
                    if ( !notification.enabled ) {
                        delete type.notifications[notification.notification];
                    }
                    else {
                        notification.channels ??= {};

                        for ( const channel of ["internal", "email", "telegram", "push"] ) {
                            notification.channels[channel] ??= {
                                channel,
                            };

                            if ( this.app.notifications.isChannelEnabled( channel ) ) {
                                notification.channels[channel].enabled ??= true;
                            }
                            else {
                                notification.channels[channel].enabled = false;
                            }

                            if ( notification.channels[channel].enabled ) {
                                notification.channels[channel].editable ??= true;
                                notification.channels[channel].subscribed ??= true;
                            }
                            else {
                                notification.channels[channel].editable = false;
                                notification.channels[channel].subscribed = false;
                            }
                        }
                    }
                }
            }
        }

        this.#types = types;

        return result( 200 );
    }

    async #resolveAclId ( aclObjectId, aclResolver ) {
        const resolver = this.app.api.acl.resolvers[aclResolver];

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

            if ( this.#types[aclType] ) {
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
                "aclTypeId": res.data.acl_type_id,
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
            if ( !this.#types[aclType].roles[role] ) return result( [400, `ACL roles are invalid`] );

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

    // XXX
    async #sendNotification ( aclId, notificationType, subject, body ) {
        const type = await this.#getAclType( aclId );

        if ( !type ) return result( [400, `Invalid ACL id`] );

        const notification = this.#types[type]?.notifications?.[notificationType];

        if ( !notification ) return result( [400, `Notification is invalid`] );

        var res;

        if ( notification.roles ) {
            const roles = notification.roles.map( role => this.#types[type].roles[role].id );

            res = await this.dbh.select(
                sql`
WITH acl_user1 AS (
    SELECT DISTINCT ON ( acl_user.user_id )
        acl_user.user_id AS id,
        acl_user.acl_id
    FROM
        acl_user,
        acl_user_role
    WHERE
        acl_user.acl_id = ?
        AND acl_user.enabled = TRUE
        AND acl_user.acl_id = acl_user_role.acl_id
        AND acl_user.user_id = acl_user_role.user_id
        AND acl_user_role.acl_role_id IN ( SELECT json_array_elements_text( ? )::int8 )
)
SELECT
    "user".id,
    "user".email,
    acl_user_notification.internal,
    acl_user_notification.email,
    acl_user_notification.telegram,
    acl_user_notification.push
FROM
    "user",
    acl_user1
    LEFT JOIN acl_user_notification ON (
        acl_user1.acl_id = acl_user_notification.acl_id
        AND acl_user1.id = acl_user_notification.user_id
        AND acl_user_notification.acl_notification_id = ?
    )
WHERE
    acl_user1.id = "user".id
    AND "user".enabled
`,
                [aclId, roles, notification.id]
            );
        }
        else {
            res = await this.dbh.select(
                sql`
SELECT
    "user".id,
    "user".email,
    acl_user_notification.internal,
    acl_user_notification.email,
    acl_user_notification.telegram,
    acl_user_notification.push
FROM
    "user",
    acl_user
    LEFT JOIN acl_user_notification ON (
        acl_user.acl_id = acl_user_notification.acl_id
        AND acl_user.user_id = acl_user_notification.user_id
        AND acl_user_notification.acl_notification_id = ?
    )
WHERE
    acl_user.acl_id = ?
    AND acl_user.enabled
    AND acl_user.user_id = "user".id
    AND "user".enabled
`,
                [notification.id, aclId]
            );
        }

        if ( !res.ok ) return res;

        const users = res.data;

        if ( !users ) return result( 200 );

        // XXX build users notification profile

        // XXX send
    }
}
