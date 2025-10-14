import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { exists } from "#lib/fs";
import tar from "#lib/tar";
import { TmpDir } from "#lib/tmp";
import uuid from "#lib/uuid";
import utils from "./utils.js";

export default class Backup {
    #cluster;
    #backupsDir;
    #walsDir;

    constructor ( cluster ) {
        this.#cluster = cluster;

        this.#backupsDir = path.join( this.cluster.backupsDir, "backups" );
        this.#walsDir = path.join( this.cluster.backupsDir, "wals" );
    }

    // properties
    get cluster () {
        return this.#cluster;
    }

    get backupsDir () {
        return this.#backupsDir;
    }

    get walsDir () {
        return this.#walsDir;
    }

    // public
    async makeBackup ( { label, incremental } = {} ) {
        const id = uuid(),
            backupDir = path.join( this.backupsDir, id ),
            args = [

                //
                "--pgdata=" + backupDir,
                "--username=" + this.cluster.config.replication.username,
                "--wal-method=stream",
                "--format=tar",
                "--gzip",
            ];

        if ( label ) {
            args.push( "--label", label );
        }

        if ( incremental ) {
            args.push( "--incremental", path.join( this.backupsDir, incremental, "backup_manifest" ) );
        }

        try {
            var res = await new Promise( resolve => {
                childProcess
                    .spawn( `${ this.cluster.binDir }/pg_basebackup`, args, {
                        "stdio": "inherit",
                        "uid": utils.uid,
                        "gid": utils.gid,
                    } )
                    .on( "exit", code => {
                        var res;

                        if ( code ) {
                            res = result( [ 500, `pg_basebackup error, code: ${ code }` ] );
                        }
                        else {
                            res = result( 200 );
                        }

                        resolve( res );
                    } );
            } );

            if ( !res.ok ) throw res;

            const backupLabel = await this.#parseBackupLabel( backupDir );

            if ( !incremental ) {
                res = await this.#cleanupWals( backupLabel.startLsnFilename );

                if ( !res.ok ) throw res;
            }

            return result( 200, {
                id,
                "type": incremental
                    ? "incremental"
                    : "full",
                "incrementalParentId": incremental,
                ...backupLabel,
            } );
        }
        catch ( e ) {

            // cleanup
            await fs.promises.rm( backupDir, {
                "recursive": true,
                "force": true,
            } );

            return result.catch( e, { "log": false } );
        }
    }

    // XXX
    async combineBackups ( ids, { archive } = {} ) {
        return this.#combineBackups( ids, { archive } );
    }

    // XXX
    async restoreBackup () {}

    async initBackupsDir () {
        await fs.promises.mkdir( this.backupsDir, { "recursive": true } );
        await utils.chmodDir( this.backupsDir, { "recursive": true } );

        await fs.promises.mkdir( this.walsDir, { "recursive": true } );
        await utils.chmodDir( this.walsDir, { "recursive": true } );
    }

    // private
    async #parseBackupLabel ( backupDir ) {

        // extract backup_label
        if ( await exists( path.join( backupDir, "base.tar.gz" ) ) ) {
            var extracted = true;

            await tar.extract(
                {
                    "cwd": backupDir,
                    "file": path.join( backupDir, "base.tar.gz" ),
                },
                [ "backup_label" ]
            );
        }

        const backupLabel = {},
            configPath = path.join( backupDir, "backup_label" ),
            content = await fs.promises.readFile( configPath, "utf8" );

        if ( extracted ) {
            await fs.promises.rm( configPath, { "force": true } );
        }

        for ( let line of content.split( "\n" ) ) {
            line = line.trim();

            if ( !line ) continue;

            const match = line.match( /^(?<key>[^:]+): +(?<value>.+)$/ ),
                key = match.groups.key,
                value = match.groups.value;

            if ( /^(START|STOP) WAL LOCATION$/.test( key ) ) {
                const prefix = key.startsWith( "START" )
                        ? "START"
                        : "STOP",
                    match = value.match( /^(?<lsn>[^ ]+) \(file (?<file>[^)]+)\)$/ );

                backupLabel[ prefix + " WAL" ] = match.groups.lsn;
                backupLabel[ prefix + " WAL FILE" ] = match.groups.file;
            }
            else {
                backupLabel[ key ] = value;
            }
        }

        return {
            "label": backupLabel[ "LABEL" ],
            "startTime": backupLabel[ "START TIME" ],
            "timeline": backupLabel[ "START TIMELINE" ],
            "startLsn": backupLabel[ "START WAL" ],
            "startLsnFilename": backupLabel[ "START WAL FILE" ],
            "stopLsn": backupLabel[ "STOP WAL" ],
            "stopLsnFilename": backupLabel[ "STOP WAL FILE" ],
            "incrementalFromLsn": backupLabel[ "INCREMENTAL FROM LSN" ],
        };
    }

    async #cleanupWals ( startLsnFilename ) {
        const args = [

            //
            "--clean-backup-history",
            "--strip-extension=.gz",
            this.walsDir,
            startLsnFilename,
        ];

        return new Promise( resolve => {
            childProcess
                .spawn( `${ this.cluster.binDir }/pg_archivecleanup`, args, {
                    "stdio": "inherit",
                    "uid": this.cluster.uid,
                    "gid": this.cluster.gid,
                } )
                .on( "exit", code => {
                    var res;

                    if ( code ) {
                        res = result( [ 500, `pg_archivecleanup error, code: ${ code }` ] );
                    }
                    else {
                        res = result( 200 );
                    }

                    resolve( res );
                } );
        } );
    }

    // XXX
    async #combineBackups ( ids, { archive } = {} ) {
        var res;

        const output = new TmpDir(),
            tmp = [];

        try {
            await utils.chmodDir( output.path );

            const args = [

                //
                "--link",
                "--output=" + output.path,
            ];

            for ( const id of ids ) {
                const tmpDir = new TmpDir();
                tmp.push( tmpDir );

                args.push( tmpDir.path );

                await fs.promises.cp( path.join( this.backupsDir, id, "backup_manifest" ), path.join( tmpDir.path, "backup_manifest" ) );

                await tar.extract( {
                    "cwd": tmpDir.path,
                    "file": path.join( this.backupsDir, id, "base.tar.gz" ),
                } );

                const walsPath = path.join( this.backupsDir, id, "pg_wal.tar.gz" );

                if ( await exists( walsPath ) ) {
                    await tar.extract( {
                        "cwd": path.join( tmpDir.path, "pg_wal" ),
                        "file": walsPath,
                    } );
                }

                await utils.chmodDir( tmpDir.path, { "recursive": true } );
            }

            res = await new Promise( resolve => {
                childProcess
                    .spawn( `${ this.cluster.binDir }/pg_combinebackup`, args, {
                        "stdio": "inherit",
                        "uid": utils.uid,
                        "gid": utils.gid,
                    } )
                    .on( "exit", code => {
                        var res;

                        if ( code ) {
                            res = result( [ 500, `pg_combinebackup error, code: ${ code }` ] );
                        }
                        else {
                            res = result( 200 );
                        }

                        resolve( res );
                    } );
            } );

            if ( !res.ok ) throw res;

            if ( archive ) {
                archive = new TmpDir();

                // parse backup label
                const config = await this.#parseBackupLabel( output.path );

                await fs.promises.cp( path.join( output.path, "backup_manifest" ), path.join( archive.path, "backup_manifest" ) );

                await tar.create( {
                    "cwd": output.path,
                    "gzip": true,
                    "portable": true,
                    "filter": ( path, stat ) => path !== "backup_manifest",
                    "file": archive.path + "/base.tar.gz",
                } );

                await output.destroy();

                await utils.chmodDir( archive.path, { "recursive": true } );

                res = result( 200, {
                    "output": archive,
                    "config": {
                        "type": "full",
                        ...config,
                    },
                } );
            }
            else {
                res = result( 200, {
                    output,
                } );
            }
        }
        catch ( e ) {
            await output.destroy();
            await archive?.destroy();

            res = result.catch( e, { "log": false } );
        }

        for ( const item of tmp ) await item.destroy();

        return res;
    }
}
