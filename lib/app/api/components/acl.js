import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import { isKebabCase, isKebabCasePath } from "#lib/naming-conventions";
import GlobPatterns from "#lib/glob/patterns";

const STATIC_PERMISSIONS = new Set( [ "guests", "users", "root", "telegram-bot-users" ] );

export default class extends Component {
    #resolvers = {};

    // static
    get staticPermissions () {
        return STATIC_PERMISSIONS;
    }

    // properties
    get resolvers () {
        return this.#resolvers;
    }

    // protected
    async _init () {
        const types = {};

        for ( const [ type, typeSpec ] of Object.entries( this.app.acl.config.types ) ) {
            types[ type ] = {
                type,
                "roles": {},
                "notifications": {},
            };

            for ( const [ role, roleSpec ] of Object.entries( typeSpec.roles ) ) {
                types[ type ].roles[ role ] = {
                    role,
                    ...roleSpec,
                };
            }

            if ( typeSpec.notifications ) {
                for ( const [ notification, notificationSpec ] of Object.entries( typeSpec.notifications ) ) {
                    types[ type ].notifications[ notification ] = {
                        notification,
                        ...notificationSpec,
                    };
                }
            }
        }

        const allPermissions = new Set();

        // check api schema permissions, create permissions index
        {
            for ( const method of Object.values( this.api.schema.methods ) ) {
                if ( !method.permission ) continue;

                // static permission
                if ( STATIC_PERMISSIONS.has( method.permission ) ) continue;

                // validate permission name
                const [ namespace, name ] = method.permission.split( ":" );
                if ( !isKebabCasePath( namespace, { "absolute": false, "folder": false } ) || !isKebabCase( name ) ) return result( [ 500, `Permission "${ method.permission }" is invalid` ] );

                allPermissions.add( method.permission );
            }
        }

        // acl types
        {
            for ( const type of Object.values( types ) ) {

                // roles
                for ( const role of Object.values( type.roles ) ) {
                    const resolvedPermissions = new Set(),
                        globPatterns = new GlobPatterns().add( role.permissions );

                    // resolve role permissions
                    for ( const schemaPermission of allPermissions ) {
                        // eslint-disable-next-line unicorn/prefer-regexp-test
                        if ( globPatterns.match( schemaPermission ) ) {
                            resolvedPermissions.add( schemaPermission );
                        }
                    }

                    role.permissions = [ ...resolvedPermissions ];
                }

                // notifications
                if ( type.notifications ) {
                    for ( const notification of Object.values( type.notifications ) ) {
                        if ( !notification.roles ) continue;

                        // check notification roles
                        for ( const role of notification.roles ) {
                            if ( !type.roles[ role ] ) {
                                return result( [ 400, `ACL notification ${ notification.notification } role ${ role } is not defined` ] );
                            }
                        }
                    }
                }
            }
        }

        // acl resolvers
        {
            for ( const [ aclResolver, query ] of Object.entries( this.api.schema.aclResolvers ) ) {
                this.#resolvers[ aclResolver ] = query ? sql( query ).prepare() : null;
            }
        }

        // check api methods acl object types
        {
            for ( const method of Object.values( this.api.schema.methods ) ) {
                if ( !method.aclResolvers ) continue;

                for ( const aclResolver of method.aclResolvers ) {
                    if ( !( aclResolver in this.#resolvers ) ) {
                        return result( [ 500, `ACL object type "${ aclResolver }" is not registered` ] );
                    }
                }
            }
        }

        const res = await this.app.acl.updateTypes( types );
        if ( !res.ok ) return res;

        return result( 200 );
    }
}
