require( "@softvisio/core" );
const mixins = require( "../../mixins" );
const fs = require( "fs" );
const sql = require( "../../sql" );
const Read = require( "./read" );
const Upload = require( "./upload" );

module.exports = Super =>

    /** class: ElectronUpdates
     * summary: Electrron updates management.
     * permissions:
     *   - admin
     */
    class extends mixins( Read, Upload, Super ) {
        readMaxLimit = 100;
        readDefaultOrderBy = [["name", "DESC"]];

        // TODO must be set in subclass
        cdnPath = "./cdn";
        downloadBaseUrl; // http:/devel

        /** method: API_read
         * summary: Read list of updates.
         * params:
         *   - name: options
         *     schema:
         *       apiReader:
         *         id: { type: integer, conditions: ["="], sortable: true }
         *         search: { type: string, conditions: ["like"] }
         */
        async API_read ( auth, args = {} ) {
            var where = this.dbh.WHERE();

            // get by id
            if ( args.id ) {
                where.and( sql`"id" = ${args.id}` );
            }

            const totalQuery = sql`SELECT COUNT(*) AS "total" FROM "electron_updates"`.WHERE( where );

            const mainQuery = sql`SELECT * FROM "electron_updates"`.WHERE( where );

            return this._read( totalQuery, mainQuery, args );
        }

        // XXX wrong spec
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
        async API_create ( auth, args ) {
            return await this._upload( auth, args, this._onUploadFinish.bind( this ), {
                "onStart": this._onUploadStart.bind( this ),
                "onHash": this._onUploadHash.bind( this ),
            } );
        }

        _onUploadStart ( upload ) {
            if ( !upload.data.version.match( /^\d+[.]\d+[.]\d+$/ ) ) return result( [400, "Version is invalid"] );

            upload.data.version_sort = this._getVersionSort( upload.data.version );

            return result( 200 );
        }

        async _onUploadHash ( upload ) {
            const res = await this.dbh.selectRow( sql`SELECT "id" FROM "electron_updates" WHERE "id" = ? OR "version" = ?`, [upload.hash, upload.data.version] );

            if ( !res.data ) {
                return result( 200 );
            }
            else {
                return result( [400, "Release is already uploaded."] );
            }
        }

        async _onUploadFinish ( upload ) {
            const res = await this.dbh.do( sql`INSERT INTO "electron_updates" ("id", "platform", "arch", "version", "version_sort") VALUES (?, ?, ?, ?, ?)`, [upload.hash, upload.data.platform, upload.data.arch, upload.data.version, upload.data.version_sort] );

            if ( !res.ok ) return res;

            if ( !fs.existsSync( this.cdnPath + "/electron-updates" ) ) fs.mkdirSync( this.cdnPath + "/electron-updates", { "recursive": true } );

            fs.copyFileSync( upload.path, this.cdnPath + "/electron-updates/" + upload.hash );

            return result( 200 );
        }

        /** method: API_delete
         * summary: Remove update.
         * params:
         *   - name: updateId
         *     required: true
         *     schema:
         *       type: integer
         */
        async API_delete ( auth, updateId ) {
            const res = await this.dbh.do( sql`DELETE FROM "electron_updates" WHERE "id" = ?`, [updateId] );

            fs.unlinkSync( this.cdnPath + "/electron-updates/" + updateId );

            return res;
        }

        /** method: API_set_published
         * summary: Set update enabled.
         * params:
         *   - name: updateId
         *     required: true
         *     schema:
         *       type: integer
         *   - name: published
         *     required: true
         *     schema:
         *       type: boolean
         */
        async API_set_published ( auth, updateId, published ) {
            const res = await this.dbh.do( sql`UPDATE "electron_updates" SET "published" = ? WHERE "id" = ?`, [published, updateId] );

            return res;
        }

        /** method: API_check
         * summary: Check for updates.
         * permissions:
         *   - "*"
         * params:
         *   - name: options
         *     required: true
         *     schema:
         *       type: object
         *       properties:
         *         platform:
         *           type: string
         *           enum:
         *             - win32
         *             - linux
         *             - darwin
         *         arch:
         *           type: string
         *           enum:
         *             - x64
         *             - x32
         *         version: { type: string }
         *       required:
         *         - platform
         *         - arch
         *         - version
         *       additionalProperties: false
         */
        async API_check ( auth, options ) {
            const res = await this.dbh.selectRow( sql`SELECT "id", "version_sort" FROM "electron_updates" WHERE "platform" = ? AND "arch" = ? AND "published" = TRUE ORDER BY "version_sort" DESC`, [options.platform, options.arch] );

            if ( !res.ok ) return res;

            if ( !res.data ) return result( 200 );

            const remoteVerSort = this._get_version_sort( options.version );

            // no next version availale
            if ( res.data.version_sort <= remoteVerSort ) return result( 200 );

            return result( 200, {
                "hash": res.data.id,
                "download_url": this.downloadBaseUrl + "/electron-updates/" + res.data.id,
            } );
        }

        _getVersionSort ( ver ) {
            ver = ver.split( "." );

            return 100000000 * ver[0] + 10000 * ver[1] + ver[2];
        }
    };
