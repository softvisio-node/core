import sql from "#lib/sql";
import constants from "#lib/app/constants";

export default class Acl {
    #app;
    #config;

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

    get types () {
        return this.#config.types;
    }

    // public
    async configure () {

        // collect components acls
        for ( const component of this.app.components ) {
            if ( component.name === "acl" ) continue;

            const acl = component.config?.acl;

            if ( !acl ) continue;

            for ( const [name, value] of Object.entries( acl ) ) {
                if ( this.config.types[name] ) {
                    return result( [400, `ACL "${name}" is already defined`] );
                }

                this.config.types[name] = value;
            }
        }

        return result( 200 );
    }

    // XXX store acl
    async init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        // sync data
        res = await this.dbh.begin( async dbh => {
            var res;

            // set transaction level lock
            res = await dbh.selectRow( sql`SELECT pg_advisory_xact_lock( ${dbh.schema.getLockId( "acl/sync" )} )` );
            if ( !res.ok ) throw res;

            res = await dbh.select( sql`
SELECT
    acl_type.id AS type_id,
    acl_type.type,
    acl_type.enabled AS type_enabled,
    acl_role.id AS role_id,
    acl_role.role,
    acl_role.enabled AS role_enabled,
    acl_permission.permission
FROM
    acl_type
    LEFT JOIN acl_role ON ( acl_type.id = acl_role.acl_type_id )
    LEFT JOIN acl_permission ON ( acl_role.id = acl_permission.acl_role_id )
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

                    index[row.type].roles ??= {};
                    index[row.type].roles[row.role] ??= {};
                    index[row.type].roles[row.role].role = row.role;
                    index[row.type].roles[row.role].id = row.role_id;
                    index[row.type].roles[row.role].enabled = row.role_enabled;

                    index[row.type].roles[row.role].permissions ??= [];
                    index[row.type].roles[row.role].permissions.push( row.permission );
                }
            }

            // scan for deleted types
            for ( const type of Object.values( index ) ) {

                // acl type was deleted
                if ( !this.types[type.type] && type.enabled ) {

                    // disable acl type
                    res = await dbh.do( sql`UPDATE acl_type SET enabled = FALSE WHERE id = ?`, [type.id] );
                    if ( !res.ok ) throw res;

                    type.enabled = false;
                }
            }

            // sync types
            for ( const type of Object.values( this.types ) ) {

                // add acl type
                if ( !index[type.type] ) {
                    res = await dbh.selectRow( sql`INSERT INTO acl_type ( id, type ) VALUES ( ?, ? ) RETURNING id`, [type.type === constants.defaultAclType ? constants.defaultAclId : null, type.type] );
                    if ( !res.ok ) throw res;

                    index[type.type] = {
                        "id": res.data.id,
                        "enabled": true,
                        "roles": {},
                    };
                }

                // enable acl type
                else if ( !index[type.type].enabled ) {
                    res = await dbh.do( sql`UPDATE acl_type SET enabled = TRUE WHERE id = ?`, [index[type.type].id] );
                    if ( !res.ok ) throw res;

                    index[type.type].enabled = true;
                }

                // scan for deleted roles
                for ( const role of Object.values( index[type.type].roles ) ) {

                    // role was deleted
                    if ( !type.roles[role.role] && role.enabled ) {

                        // disable acl role
                        res = await dbh.do( sql`UPDATE acl_role SET enabled = FALSE WHERE id = ?`, [role.id] );
                        if ( !res.ok ) throw res;

                        role.enabled = false;
                    }
                }

                // sync roles
                for ( const role of Object.values( type.roles ) ) {

                    // add acl role
                    if ( !index[type.type].roles[role.role] ) {
                        res = await dbh.selectRow( sql`INSERT INTO acl_role ( acl_type_id, role ) VALUES ( ?, ? ) RETURNING id`, [index[type.type].id, role.role] );
                        if ( !res.ok ) throw res;

                        index[type.type].roles[role.role] = {
                            "id": res.data.id,
                            "enabled": true,
                            "permissions": [],
                        };
                    }

                    // enable acl role
                    else if ( !index[type.type].roles[role.role].enabled ) {
                        res = await dbh.do( sql`UPDATE acl_role SET enabled = TRUE WHERE id = ?`, [index[type.type].roles[role.role].id] );
                        if ( !res.ok ) throw res;

                        index[type.type].roles[role.role].enabled = true;
                    }

                    // scan for deleted permissions
                    const deletedPermissions = [];

                    for ( const permission of index[type.type].roles[role.role].permissions ) {
                        if ( !role.permissions.includes( permission ) ) deletedPermissions.push( permission );
                    }

                    // delete permissions
                    if ( deletedPermissions.length ) {
                        res = await dbh.do( sql`DELETE FROM acl_permission WHERE acl_role_id = ${index[type.type].roles[role.role].id} AND permission`.IN( deletedPermissions ) );
                        if ( !res.ok ) throw res;
                    }

                    // scan for added permissions
                    const addedPermissions = [];

                    for ( const permission of role.permissions ) {
                        if ( !index[type.type].roles[role.role].permissions.includes( permission ) ) {
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
                    }
                }
            }

            // create default acl
            res = await dbh.do( sql`INSERT INTO acl ( id, acl_type_id ) VALUES ( ?, ? ) ON CONFLICT ( id ) DO NOTHING`, [constants.defaultAclId, constants.defaultAclId] );
            if ( !res.ok ) throw res;
        } );

        return result( 200 );
    }

    // XXX dbh events, cache, load acl
    async start () {
        return result( 200 );
    }

    async sendNotification ( aclId, type, subject, body ) {}
}
