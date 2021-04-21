require( "#index" );

const mixins = require( "#lib/mixins" );
const { ROOT_USER_ID } = require( "../../../const" );
const sql = require( "#lib/sql" );
const Read = require( "../read" );

module.exports = Super =>

    /** class: Users
     * summary: App users management.
     * permissions: [admin]
     */
    class extends mixins( Read, Super ) {
        readRoot = false;
        readMaxLimit = 100;
        readDefaultOrderBy = [["name", "DESC"]];

        /** method: API_read
         * summary: Read users.
         * params:
         *   - name: options
         *     schema:
         *       apiRead:
         *         id: { type: string, conditions: ["="], sortable: true }
         *         search: { type: string, conditions: ["like"] }
         *         name: { sortable: true }
         *         created: { sortable: true }
         *         enabled: { sortable: true }
         */
        async API_read ( auth, args = {} ) {
            var where = this.dbh.WHERE();

            // get by id
            if ( args.id ) {
                where.and( sql`"user"."id" = ${args.id}` );
            }

            // get all matched rows
            else {

                // filter root user
                if ( !this.readRoot ) {
                    where.and( sql`"user"."id" != ${ROOT_USER_ID}` );
                }

                // filter search
                if ( args.where && args.where.search ) {
                    where.and( { "user.name": args.where.search }, "OR", { "user.email": args.where.search }, "OR", { "user.telegram_name": args.where.search } );

                    delete args.where.search;
                }
            }

            const totalQuery = sql`SELECT COUNT(*) AS "total" FROM "user"`.WHERE( where );

            const mainQuery = sql`
                    SELECT
                        *,
                        CASE
                            WHEN "user"."gravatar" IS NOT NULL
                            THEN 'https://s.gravatar.com/avatar/' || "user"."gravatar" || ${"?d=" + this.api.defaultGravatarImage}
                            ELSE ${this.api.defaultGravatarUrl}
                        END "avatar"
                    FROM
                        "user"
                    `.WHERE( where );

            return this._read( totalQuery, mainQuery, args );
        }

        /** method: API_create
         * summary: Create user.
         * params:
         *   - name: fields
         *     required: true
         *     schema:
         *       type: object
         *       properties:
         *         username: { type: string }
         *         password: { type: string }
         *         enabled: { type: boolean }
         *         permissions:
         *           type: object
         *           additionalProperties: { type: boolean }
         *         email: { type: string }
         *         telegram_name: { type: string }
         *       required:
         *         - username
         */
        async API_create ( auth, fields ) {
            var { username, password, enabled, permissions } = fields;

            if ( enabled == null ) enabled = this.api.newUserEnabled;

            delete fields.username;
            delete fields.password;
            delete fields.enabled;
            delete fields.permissions;

            // check permissions
            if ( !auth.isRoot && permissions ) {
                if ( !auth.hasPermissions( Object.keys( permissions ) ) ) return result( [400, "Permissions are invalid"] );
            }

            return this.api.createUser( username, password, enabled, permissions, fields );
        }

        /** method: API_delete
         * summary: Remove user.
         * params:
         *   - name: userId
         *     required: true
         *     schema:
         *       type: string
         */
        async API_delete ( auth, userId ) {

            // user can't remove itself
            if ( userId === auth.userId ) return result( [400, `You can't remove yourself`] );

            return this.api.removeUser( userId );
        }

        /** method: API_set_enabled
         * summary: Set user enabled.
         * params:
         *   - name: userId
         *     summary: User id or name.
         *     required: true
         *     schema:
         *       type: string
         *   - name: enabled
         *     required: true
         *     schema:
         *       type: boolean
         */
        async API_set_enabled ( auth, userId, enabled ) {

            // user can't disable itself
            if ( userId === auth.userId || userId === auth.username ) return result( [400, `You can't change own enabled status`] );

            return this.api.setUserEnabled( userId, enabled );
        }

        /** method: API_set_password
         * summary: Set user password.
         * params:
         *   - name: userId
         *     summary: User id or name.
         *     required: true
         *     schema:
         *       type: string
         *   - name: pasword
         *     schema:
         *       type: string
         */
        async API_set_password ( auth, userId, password ) {

            // user can't set root password
            if ( this.api.userIsRoot( userId ) && !auth.isRoot ) return result( [400, `You can't change root user password`] );

            return this.api.setUserPassword( userId, password );
        }

        /** method: API_get_permissions
         * summary: Get user permissions.
         * params:
         *   - name: userId
         *     required: true
         *     schema:
         *       type: string
         */
        async API_get_permissions ( auth, userId ) {
            var permissions = await this.api.getUserPermissions( userId, auth.permissions );

            if ( !permissions.ok ) return permissions;

            return permissions;
        }

        /** method: API_set_permissions
         * summary: Set user permissions.
         * params:
         *   - name: userId
         *     required: true
         *     schema:
         *       type: string
         *   - name: permissions
         *     required: true
         *     schema:
         *       type: object
         *       additionalProperties: { type: boolean }
         */
        async API_set_permissions ( auth, userId, permissions ) {

            // unable to modify own permissions
            if ( userId === auth.userId ) return result( [400, "You are unable to change own permissions"] );

            // unable to modify root permissions
            if ( this.api.userIsRoot( userId ) ) return result( [400, "You are unable to change root user permissions"] );

            // check permissions
            if ( !auth.isRoot ) {
                for ( const permission in permissions ) {
                    if ( !auth.permissions[permission] ) return result( [400, "Permissions are invalid"] );
                }
            }

            // set permissions
            return this.api.setUserPermissions( userId, permissions );
        }

        /** method: API_update_permissions
         * summary: Set user permissions.
         * params:
         *   - name: userId
         *     required: true
         *     schema:
         *       type: string
         *   - name: permissions
         *     required: true
         *     schema:
         *       type: object
         *       additionalProperties: { type: boolean }
         */
        async API_update_permissions ( auth, userId, permissions ) {

            // unable to modify own permissions
            if ( userId === auth.userId ) return result( [400, "You are unable to change own permissions"] );

            // unable to modify root permissions
            if ( this.api.userIsRoot( userId ) ) return result( [400, "You are unable to change root user permissions"] );

            // check permissions
            if ( !auth.isRoot ) {
                for ( const permission in permissions ) {
                    if ( !auth.permissions[permission] ) return result( [400, "Permissions are invalid"] );
                }
            }

            // set permissions
            return this.api.updateUserPermissions( userId, permissions );
        }

        /** method: API_suggest
         * summary: Suggest user name.
         * params:
         *   - name: options
         *     schema:
         *       type: object
         *       properties:
         *         where:
         *           type: object
         *           properties:
         *             name:
         *               type: array
         *               items:
         *                 - operator:
         *                     type: string
         *                     enum:
         *                       - like
         *                 - name:
         *                     type: string
         */
        async API_suggest ( auth, args ) {
            var where;

            if ( args && args.where && args.where.name ) {
                where = this.dbh.WHERE( { "name": ["LIKE", args.where.name[1]] }, "OR", { "email": ["LIKE", args.where.name[1]] }, "OR", { "telegram_name": ["LIKE", args.where.name[1]] } );
            }

            return this.dbh.selectAll( sql`SELECT "id", "name" FROM "user"`.WHERE( where ).ORDER_BY( "name" ).LIMIT( 100 ) );
        }

        /** method: API_set_username
         * summary: Change user name.
         * params:
         *   - name: user_id
         *     required: true
         *     schema:
         *       type: string
         *   - name: new_username
         *     required: true
         *     schema:
         *       type: string
         *   - name: new_password
         *     schema:
         *       type: string
         */
        async API_set_username ( auth, userId, username, password ) {
            return await this.api.setUserName( userId, username, password );
        }
    };
