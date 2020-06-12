const { mixin, mix } = require( "../../mixins" );
const { ROOT_USER_ID } = require( "../../const" );
const { sql, WHERE } = require( "../../sql" );
const Read = require( "../read" );

module.exports = mixin( ( Super ) =>

/** class: Users
         * permissions: admin
         */
    class extends mix( Read, Super ) {
            defaultGravatar;
            defaultGravatarImage;
            readRoot = false;

            readMaxLimit = 100;
            readDefaultOrderBy = [["name", "DESC"]];

            #api;
            #dbh;

            constructor ( app, api, options ) {
                super( app, api, options );

                this.#api = api;
                this.#dbh = options.dbh;
            }

            /** method: API_read
             * summary: Read users.
             * params:
             *   - name: options
             *     summary:
             *     schema:
             *       type: object
             *       properties:
             *         id: {type: number}
             *         where:
             *           type: object
             *           properties:
             *             search: {type: object}
             *           additionalProperties: false
             *         order_by: {}
             *         limit: {type: number}
             *         offset: {type: number}
             *       additionalProperties: false
             */
            async API_read ( auth, args = {} ) {
                var where = WHERE();

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
        WHEN "user"."gravatar" IS NOT NULL THEN 'https://s.gravatar.com/avatar/' || "user"."gravatar" || '?d=${this.defaultGravatarImage}'
        ELSE '${this.defaultGravatar}'
    END "avatar"
FROM
    "user"
                    `.WHERE( where );

                return this._read( totalQuery, mainQuery, args );
            }

            // TODO
            async API_create ( auth, args ) {}

            /** method: API_delete
             * summary: Remove user.
             * params:
             *   - name: userId
             *     required: true
             *     schema:
             *       type: number
             */
            async API_delete ( auth, userId ) {
                return this.#api.removeUser( userId );
            }

            /** method: API_set_enabled
             * summary: Set user enabled.
             * params:
             *   - name: userId
             *     required: true
             *     schema:
             *       type: number
             *   - name: enabled
             *     required: true
             *     schema:
             *       type: boolean
             */
            async API_set_enabled ( auth, userId, enabled ) {

                // user can't disable itself
                if ( userId === auth.userId ) return [400, `You can't disable yourself`];

                return this.#api.setUserEnabled( userId, enabled );
            }

            /** method: API_set_permissions
             * summary: Set user permissions.
             * params:
             *   - name: userId
             *     required: true
             *     schema:
             *       type: number
             *   - name: permissions
             *     required: true
             *     schema:
             *       type: object
             *       additionalProperties: {type: boolean}
             */
            async API_set_permissions ( auth, userId, permissions ) {

                // unabe to modify own permissions
                if ( userId === auth.userId ) return [400, "Unable to change own permissions"];

                // unable to modify root permissions
                if ( this.#api.userIsRoot( userId ) ) return [400, "Unable to change root permissions"];

                // check permissions
                if ( !auth.isRoot() ) {
                    for ( const permission in permissions ) {
                        if ( !auth.hasPermission( permission ) ) return [[400, "Permissions are invalid"]];
                    }
                }

                // set permissions
                return this.#api.setUserPermissions( userId, permissions );
            }

            /** method: API_update_permissions
             * summary: Set user permissions.
             * params:
             *   - name: userId
             *     required: true
             *     schema:
             *       type: number
             *   - name: permissions
             *     required: true
             *     schema:
             *       type: object
             *       additionalProperties: {type: boolean}
             */
            async API_update_permissions ( auth, userId, permissions ) {

                // unabe to modify own permissions
                if ( userId === auth.userId ) return [400, "Unable to change own permissions"];

                // unable to modify root permissions
                if ( this.#api.userIsRoot( userId ) ) return [400, "Unable to change root permissions"];

                // check permissions
                if ( !auth.isRoot() ) {
                    for ( const permission in permissions ) {
                        if ( !auth.hasPermission( permission ) ) return [[400, "Permissions are invalid"]];
                    }
                }

                // set permissions
                return this.#api.updateUserPermissions( userId, permissions );
            }

            // TODO
            async API_suggest ( auth, args = {} ) {}
    } );
