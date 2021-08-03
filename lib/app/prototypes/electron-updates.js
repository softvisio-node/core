import mixins from "#lib/mixins";
import Base from "./base.js";
import Read from "./mixins/read.js";
import fs from "fs";
import sql from "#lib/sql";

export default class extends mixins( Read, Base ) {

    // TODO must be set in subclass
    cdnPath = "./cdn";
    downloadBaseUrl; // http:/devel

    async API_read ( ctx, args = {} ) {
        var where = this.dbh.WHERE();

        // get by id
        if ( args.id ) {
            where.and( sql`"id" = ${args.id}` );
        }

        const totalQuery = sql`SELECT COUNT(*) AS "total" FROM "electron_updates"`.WHERE( where );

        const mainQuery = sql`SELECT * FROM "electron_updates"`.WHERE( where );

        return this._read( ctx, totalQuery, mainQuery, args );
    }

    // XXX wrong spec
    async API_create ( ctx, file, data ) {
        if ( !data.version.match( /^\d+[.]\d+[.]\d+$/ ) ) return result( [400, "Version is invalid"] );

        data.version_sort = this._getVersionSort( data.version );

        var res = await this.dbh.selectRow( sql`SELECT "id" FROM "electron_updates" WHERE "version" = ?`, [data.version] );

        if ( res.data ) return result( [400, "Release is already uploaded."] );

        res = await this.dbh.do( sql`INSERT INTO "electron_updates" ("id", "platform", "arch", "version", "version_sort") VALUES (?, ?, ?, ?, ?)`, [data.version, data.platform, data.arch, data.version, data.version_sort] );

        if ( !res.ok ) return res;

        if ( !fs.existsSync( this.cdnPath + "/electron-updates" ) ) fs.mkdirSync( this.cdnPath + "/electron-updates", { "recursive": true } );

        fs.copyFileSync( file.path, this.cdnPath + "/electron-updates/" + data.version );

        return result( 200 );
    }

    async API_delete ( ctx, updateId ) {
        const res = await this.dbh.do( sql`DELETE FROM "electron_updates" WHERE "id" = ?`, [updateId] );

        fs.rmSync( this.cdnPath + "/electron-updates/" + updateId, { "force": true } );

        return res;
    }

    async API_set_published ( ctx, updateId, published ) {
        const res = await this.dbh.do( sql`UPDATE "electron_updates" SET "published" = ? WHERE "id" = ?`, [published, updateId] );

        return res;
    }

    async API_check ( ctx, options ) {
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
}
