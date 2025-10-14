import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import env from "#lib/env";
import { exists } from "#lib/fs";
import sql from "#lib/sql";
import PostgreSqlCluster from "./postgresql/cluster.js";
import utils from "./postgresql/utils.js";

// NOTE https://www.postgresql.org/docs/current/server-shutdown.html

export default class PostgreSql {
    #app;
    #config;
    #dataDir;
    #clustersDir;
    #backupsDir;
    #unixSocketDir;
    #cluster;
    #replicationHostname;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#dataDir = this.config.dataDir || this.app.env.dataDir + "/postgresql";
        if ( !path.isAbsolute( this.#dataDir ) ) this.#dataDir = path.join( env.root, this.#dataDir );

        this.#clustersDir = path.join( this.#dataDir, "clusters" );

        this.#backupsDir = path.join( this.#dataDir, "backups" );

        this.#unixSocketDir = "/var/run/postgresql";
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dataDir () {
        return this.#dataDir;
    }

    get clustersDir () {
        return this.#clustersDir;
    }

    get backupsDir () {
        return this.#backupsDir;
    }

    get unixSocketDir () {
        return this.#unixSocketDir;
    }

    get isStarted () {
        return this.#cluster?.isStarted;
    }

    get isPrimary () {
        return this.config.mode === "primary";
    }

    get isSyncStandby () {
        return this.config.mode === "standby-sync";
    }

    get isAsyncStandby () {
        return this.config.mode === "standby-async";
    }

    get replicationHostname () {
        if ( this.#replicationHostname === undefined ) {
            if ( this.isPrimary ) {
                this.#replicationHostname = null;
            }
            else if ( this.isSyncStandby ) {
                this.#replicationHostname = this.config.replication.primary.hostname;
            }
            else if ( this.isAsyncStandby ) {
                if ( this.config.replication.async.replicateFrom === "primary" ) {
                    this.#replicationHostname = this.config.replication.primary.hostname;
                }
                else {
                    this.#replicationHostname = this.config.replication.sync.hostname;
                }
            }
        }

        return this.#replicationHostname;
    }

    // public
    async init () {

        // upgrade
        if ( this.app.UPGRADE_POSTGRESQL ) {
            const res = await this.upgrade( ...this.app.UPGRADE_POSTGRESQL );

            if ( !res.ok ) return res;

            process.exit();
        }

        this.#cluster = new PostgreSqlCluster( this, process.env.POSTGRESQL_VERSION, this.config.clusterName );

        var res;

        res = await this.#init();
        if ( !res.ok ) return res;

        if ( this.isStarted ) return result( 200 );

        // init primary
        if ( this.isPrimary ) {

            // init cluster db
            if ( !this.#cluster.isExists ) {
                res = await this.#cluster.initDb();
                if ( !res.ok ) return res;
            }
        }

        // init standby
        else {

            // make base backup
            if ( !this.#cluster.isExists ) {
                res = await this.#cluster.makeBaseBackup();
                if ( !res.ok ) return res;
            }
        }

        // write hba config
        await this.#cluster.writeHbaConfig();

        // write user config
        await this.#cluster.writeUserConfig();

        // update replication role
        if ( this.isPrimary ) {
            res = await this.#initPrimary();
            if ( !res.ok ) return res;
        }

        await this.#cluster.writeReplicationConfig();

        await this.#cluster.writeBackupConfig();

        // start server
        res = await this.#cluster.start( {
            "network": true,
        } );
        if ( !res.ok ) return res;

        this.#cluster.on( "stop", this.#onClusterStop.bind( this ) );

        console.log( "PostgreSQL process started" );

        return result( 200 );
    }

    async upgrade ( oldClusterVersion, clusterName ) {
        var res;

        clusterName ||= this.config.clusterName;

        this.#cluster = new PostgreSqlCluster( this, process.env.POSTGRESQL_VERSION, clusterName );

        const oldCluster = new PostgreSqlCluster( this, oldClusterVersion, clusterName );

        // check old cluster data dir is exitsts
        if ( !oldCluster.isExists ) {
            return result( [ 500, "Old postgres cluster not found" ] );
        }

        // check new cluster is not exists
        if ( this.#cluster.isExists ) {
            console.log( `
========================================

New cluster data directory already exysts.
Remove it manually and try again:

rm -rf ${ this.#cluster.dataDir }

========================================
` );

            return result( 500 );
        }

        res = await this.#init();
        if ( !res.ok ) return res;

        // install dependencies
        if ( !oldCluster.binIsExists ) {
            res = childProcess.spawnSync( "apt", [ "update" ], { "stdio": "inherit" } );
            if ( res.status ) return result( 500 );

            res = childProcess.spawnSync(
                "apt-get",
                [

                    //
                    "install",
                    "-y",
                    "postgresql-contrib",
                    `postgresql-${ oldCluster.version }`,
                    ...[ process.env.POSTGIS_VERSION
                        ? [ `postgresql-${ oldCluster.version }-postgis-${ process.env.POSTGIS_VERSION }` ]
                        : [] ],
                ],
                {
                    "stdio": "inherit",
                }
            );
            if ( res.status ) return result( 500 );
        }

        // init new cluster
        res = await this.#cluster.initDb();
        if ( !res.ok ) return res;

        // XXX test, remove, if it is not possible to upgrade srandby
        // remove replication config, required if we upgrading standby
        await oldCluster.deleteReplicationConfig();

        // check
        res = childProcess.spawnSync(
            `${ this.#cluster.binDir }/pg_upgrade`,
            [

                //
                "--check",
                `--old-bindir=${ oldCluster.binDir }`,
                `--new-bindir=${ this.#cluster.binDir }`,
                `--old-datadir=${ oldCluster.dataDir }`,
                `--new-datadir=${ this.#cluster.dataDir }`,
            ],
            {
                "cwd": this.#cluster.dataDir,
                "stdio": "inherit",
                "uid": utils.uid,
                "gid": utils.gid,
            }
        );
        if ( res.status ) return result( 500 );

        // upgrade
        res = childProcess.spawnSync(
            `${ this.#cluster.binDir }/pg_upgrade`,
            [

                //
                `--old-bindir=${ oldCluster.binDir }`,
                `--new-bindir=${ this.#cluster.binDir }`,
                `--old-datadir=${ oldCluster.dataDir }`,
                `--new-datadir=${ this.#cluster.dataDir }`,
                "--new-options=-c timescaledb.restoring=on''",
            ],
            {
                "cwd": this.#cluster.dataDir,
                "stdio": "inherit",
                "uid": utils.uid,
                "gid": utils.gid,
            }
        );
        if ( res.status ) return result( 500 );

        // copy configs
        if ( await exists( oldCluster.autoConfigPath ) ) {
            fs.copyFileSync( oldCluster.autoConfigPath, this.#cluster.autoConfigPath );
        }

        console.log( `
========================================

Cluster upgraded to the version: ${ this.#cluster.version }.
Old cluster version ${ oldCluster.version } can be removed.

Run manually, aftes server started:

vacuumdb --all --analyze-in-stages

========================================
` );

        return result( 200 );
    }

    async start () {

        // nginx upstream
        if ( this.config.nginx.enabled && this.app.nginxUpstream ) {
            const servers = [
                {
                    "port": this.config.nginx.port,
                    "type": "tcp",
                    "ssl": true,
                },
            ];

            if ( this.config.nginx.defaultServer ) {
                servers.push( {
                    "port": this.config.nginx.port,
                    "type": "tcp",
                    "ssl": false,
                } );
            }

            await this.app.nginxUpstream.addProxy( "postgresql-server", {
                "upstreamPort": 5432,
                "serverNames": this.config.nginx.serverNames,
                servers,
            } );
        }

        return result( 200 );
    }

    async destroy () {
        return this.#cluster.stop();
    }

    // private
    async #init () {
        if ( this.isSyncStandby ) {
            if ( !this.config.replication?.sync?.numberOfStandbys ) {
                return result( [ 400, "Sync standbys are not enabled" ] );
            }
        }
        else if ( this.isAsyncStandby && this.config.replication?.async?.replicateFrom === "sync" && !this.config.replication?.sync?.numberOfStandbys ) {
            return result( [ 400, "Can't replicate from sync standby" ] );
        }

        await fs.promises.mkdir( this.dataDir, { "recursive": true } );

        await utils.chmodDir( this.dataDir, { "recursive": true } );

        return result( 200 );
    }

    async #initPrimary () {
        var res;

        await this.#cluster.deleteReplicationConfig();
        await this.#cluster.deleteBackupConfig();

        res = await this.#cluster.start( {
            "network": false,
        } );
        if ( !res.ok ) return res;

        const dbh = sql.new( "postgresql:?maxConnections=1" );

        res = await dbh.exec( sql`

-- replication role
DROP ROLE IF EXISTS`.ID( this.#config.replication.username ).sql`;

CREATE ROLE`.ID( this.#config.replication.username ).sql`WITH REPLICATION LOGIN;

ALTER ROLE`.ID( this.#config.replication.username ).sql`WITH PASSWORD ${ this.#config.replication.password };
` );

        await dbh.destroy();

        await this.#cluster.stop();

        return res;
    }

    #onClusterStop ( code, signal ) {
        console.log( `PostgreSQL process exited, code: ${ code }` );

        process.destroy( { code } );
    }
}
