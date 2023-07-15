import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import { isKebabCase, isKebabCasePath } from "#lib/utils/naming-conventions";
import GlobPatterns from "#lib/glob/patterns";

const STATIC_PERMISSIONS = new Set( ["guests", "users", "root"] );

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

        for ( const component of this.app.components ) {
            const acl = await component.getAcl();

            if ( !acl ) continue;

            for ( const [type, typeSpec] of Object.entries( acl ) ) {
                if ( types[type] ) {
                    return result( [400, `ACL "${type}" is already defined`] );
                }

                types[type] = {
                    type,
                    "roles": {},
                    "notifications": {},
                };

                for ( const [role, roleSpec] of Object.entries( typeSpec.roles ) ) {
                    types[type].roles[role] = {
                        role,
                        ...roleSpec,
                    };
                }

                if ( typeSpec.notifications ) {
                    for ( const [notification, notificationSpec] of Object.entries( typeSpec.notifications ) ) {
                        types[type].notifications[notification] = {
                            notification,
                            ...notificationSpec,
                        };
                    }
                }
            }
        }

        const allPermissions = new Set(),
            unusedPermissions = new Set();

        // check api schema permissions, create permissions index
        {
            for ( const method of Object.values( this.api.schema.methods ) ) {
                if ( !method.permission ) continue;

                // static permission
                if ( STATIC_PERMISSIONS.has( method.permission ) ) continue;

                // validate permission name
                const [namespace, name] = method.permission.split( ":" );
                if ( !isKebabCasePath( namespace, { "absolute": false, "folder": false } ) || !isKebabCase( name ) ) return result( [500, `Permission "${method.permission}" is invalid`] );

                allPermissions.add( method.permission );
                unusedPermissions.add( method.permission );
            }
        }

        // acl types
        {
            for ( const [aclType, typeSpec] of Object.entries( types ) ) {
                const roles = typeSpec.roles;

                // roles
                for ( const [role, roleSpec] of Object.entries( roles ) ) {
                    const resolvedPermissions = new Set(),
                        globPatterns = new GlobPatterns();

                    // resolve permissions masks, namespace/*, namespace:*
                    for ( const permission of roleSpec.permissions ) {
                        globPatterns.add( permission );

                        let match;

                        for ( const schemaPermission of allPermissions ) {
                            if ( globPatterns.match( schemaPermission ) ) {
                                match = true;

                                resolvedPermissions.add( schemaPermission );
                            }
                        }

                        // permission mask not resolved, error will be thrown later
                        if ( !match ) resolvedPermissions.add( permission );

                        globPatterns.clear();
                    }

                    roleSpec.permissions = [...resolvedPermissions];

                    // check obsolete permissions
                    for ( const permission of roleSpec.permissions ) {

                        // role has unknown permission
                        if ( !allPermissions.has( permission ) ) {
                            return result( [500, `ACL type "${aclType}", role "${role}", permission "${permission}" is not used by any API method`] );
                        }

                        unusedPermissions.delete( permission );
                    }
                }
            }

            // has unused permissions
            if ( unusedPermissions.size ) {
                return result( [500, `Following permissions are not used by any ACL, access to the API methods will be disabled: ${[...unusedPermissions].join( ", " )}`] );
            }
        }

        // acl resolvers
        {
            for ( const [aclResolver, query] of Object.entries( this.api.schema.aclResolvers ) ) {
                this.#resolvers[aclResolver] = query ? sql( query ).prepare() : null;
            }
        }

        // check api methods acl object types
        {
            for ( const method of Object.values( this.api.schema.methods ) ) {
                if ( !method.aclResolvers ) continue;

                for ( const aclResolver of method.aclResolvers ) {
                    if ( !( aclResolver in this.#resolvers ) ) {
                        return result( [500, `ACL object type "${aclResolver}" is not registered`] );
                    }
                }
            }
        }

        const res = await this.app.acl.updateTypes( types );
        if ( !res.ok ) return res;

        return result( 200 );
    }
}
