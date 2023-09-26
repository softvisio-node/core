import fs from "node:fs";
import childProcess from "node:child_process";
import sql from "#lib/sql";
import uuid from "#lib/uuid";
import env from "#lib/env";
import path from "node:path";
import Cron from "#lib/cron";
import glob from "#lib/glob";
import PostgreSqlCluster from "./postgresql/cluster.js";

// NOTE https://www.postgresql.org/docs/current/server-shutdown.html

const uid = +childProcess.execFileSync( "id", ["-u", "postgres"], { "encoding": "utf8" } ).trim(),
    gid = +childProcess.execFileSync( "id", ["-g", "postgres"], { "encoding": "utf8" } ).trim();

export default class PostgreSql {
    #app;
    #config;
    #dataRootDir;
    #unixSocketDir;
    #cluster;
    #standbyId;
    #replicationHostname;
    #backupCron;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#dataRootDir = this.config.dataRootDir || this.app.env.dataDir + "/postgresql";
        if ( !path.isAbsolute( this.#dataRootDir ) ) this.#dataRootDir = path.join( env.root, this.#dataRootDir );

        this.#unixSocketDir = "/var/run/postgresql";
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dataRootDir () {
        return this.#dataRootDir;
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

    get isBackupStandby () {
        return this.config.mode === "standby-backup";
    }

    get standbyId () {
        this.#standbyId ??= uuid().replaceAll( "-", "_" );

        return this.#standbyId;
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
            else if ( this.isBackupStandby ) {
                this.#replicationHostname = this.config.replication.primary.hostname;
            }
        }

        return this.#replicationHostname;
    }

    // public
    async upgrade ( clusterVersion, clusterName ) {
        var res;

        this.#cluster = new PostgreSqlCluster( this, process.env.POSTGRESQL_VERSION, this.config.clusterName );

        const oldCluster = new PostgreSqlCluster( this, clusterVersion, clusterName );

        // check old cluster data dir is exitsts
        if ( !oldCluster.isExists ) {
            return result( [500, `Old postgres cluster not found`] );
        }

        // check new cluster is not exists
        if ( this.#cluster.isExists ) {
            console.log( `
========================================

New cluster data directory already exysts.
Remove it manually and try again:

rm -rf ${this.#cluster.dataDir}

========================================
` );

            return result( 500 );
        }

        res = await this.#init();
        if ( !res.ok ) return res;

        // install dependencies
        if ( !oldCluster.binIsExists ) {
            res = childProcess.spawnSync( "apt", ["update"], { "stdio": "inherit" } );
            if ( res.status ) return result( 500 );

            res = childProcess.spawnSync(
                "apt",
                [

                    //
                    "install",
                    "postgresql-contrib",
                    `postgresql-${oldCluster.version}`,
                ],
                { "stdio": "inherit" }
            );
            if ( res.status ) return result( 500 );
        }

        // init new cluster
        res = await this.#cluster.initDb();
        if ( !res.ok ) return res;

        // XXX test, remove, if it is not possible to upgrade srandby
        // remove replication config, required if we upgrading standby
        oldCluster.deleteStandbysignl();

        // check
        res = childProcess.spawnSync(
            `${this.#cluster.binDir}/pg_upgrade`,
            [

                //
                "--check",
                `--old-bindir=${oldCluster.binDir}`,
                `--new-bindir=${this.#cluster.binDir}`,
                `--old-datadir=${oldCluster.dataDir}`,
                `--new-datadir=${this.#cluster.dataDir}`,
            ],
            {
                "cwd": this.#cluster.dataDir,
                "stdio": "inherit",
                uid,
                gid,
            }
        );
        if ( res.status ) return result( 500 );

        // upgrade
        res = childProcess.spawnSync(
            `${this.#cluster.binDir}/pg_upgrade`,
            [

                //
                `--old-bindir=${oldCluster.binDir}`,
                `--new-bindir=${this.#cluster.binDir}`,
                `--old-datadir=${oldCluster.dataDir}`,
                `--new-datadir=${this.#cluster.dataDir}`,
                `--new-options=-c timescaledb.restoring=on''`,
            ],
            {
                "cwd": this.#cluster.dataDir,
                "stdio": "inherit",
                uid,
                gid,
            }
        );
        if ( res.status ) return result( 500 );

        // copy configs
        if ( fs.existsSync( oldCluster.autoConfigPath ) ) {
            fs.copyFileSync( oldCluster.autoConfigPath, this.#cluster.autoConfigPath );
        }

        console.log( `
========================================

Cluster upgraded to the version: ${this.#cluster.version}.
Old cluster version ${oldCluster.version} can be removed.

Run manually, aftes server started:

vacuumdb --all --analyze-in-stages

========================================
` );

        return result( 200 );
    }

    async start () {
        this.#cluster = new PostgreSqlCluster( this, process.env.POSTGRESQL_VERSION, this.config.clusterName );

        var res;

        res = this.#init();
        if ( !res.ok ) return res;

        if ( this.isStarted ) return result( 200 );

        // init primary
        if ( this.isPrimary ) {

            // init db
            if ( !this.#cluster.isExists ) {
                res = await this.#cluster.initDb();
                if ( !res.ok ) return res;
            }
        }

        // ini standby
        else {

            // base backup
            if ( !this.#cluster.isExists ) {
                res = await this.#cluster.makeBaseBackup();
                if ( !res.ok ) return res;
            }
        }

        // write hba config
        this.#writeHbaConfig();

        // write postgres config
        this.#writePostgresConfig();

        // update replication role
        if ( this.isPrimary ) {
            res = await this.#initPrimary();
            if ( !res.ok ) return res;
        }

        this.#writeReplicationsConfig();

        // start server
        res = await this.#cluster.start( {
            "network": true,
            "standby": !this.isPrimary,
        } );
        if ( !res.ok ) return res;

        this.#cluster.on( "shutdown", this.#onClusterShutdown.bind( this ) );

        // init backup
        this.#startBackupCron();

        console.log( `PostgreSQL process started` );

        return result( 200 );
    }

    async stop () {
        return this.#cluster.stop();
    }

    async shutDown () {
        return this.#cluster.shutDown();
    }

    async shutDownSmart () {
        if ( !this.#cluster.isStarted ) return;

        console.log( "PostgreSQL smart shutting down" );

        return this.#cluster.shutDownSmart();
    }

    async shutDownFast () {
        if ( !this.#cluster.isStarted ) return;

        console.log( "PostgreSQL fast shutting down" );

        return this.#cluster.shutDownFast();
    }

    async shutDownImmediate () {
        if ( !this.#cluster.isStarted ) return;

        console.log( "PostgreSQL immediate shutting down started" );

        return this.#cluster.shutDownImmediate();
    }

    // private
    #init () {
        if ( this.isSyncStandby ) {
            if ( !this.config.replication?.sync?.numberOfStandbys ) {
                return result( [400, `Sync standbys are not enabled`] );
            }
        }
        else if ( this.isAsyncStandby ) {
            if ( this.config.replication?.async?.replicateFrom === "sync" && !this.config.replication?.sync?.numberOfStandbys ) {
                return result( [400, `Can't replicate from sync standby`] );
            }
        }

        fs.mkdirSync( this.#dataRootDir, { "recursive": true } );
        fs.mkdirSync( this.#cluster.dataDir, { "recursive": true } );

        // chown
        const files = glob( "/**", {
            "cwd": this.#dataRootDir,
            "directories": true,
        } );

        for ( const file of files ) {
            fs.chownSync( this.#dataRootDir + "/" + file, uid, gid );
            fs.chmodSync( this.#dataRootDir + "/" + file, 0o700 );
        }

        return result( 200 );
    }

    #writeHbaConfig () {
        const config = [];

        // generate pg_hba.conf
        if ( this.#config.access ) {
            for ( const access of this.#config.access ) {
                const line = [];

                for ( const name of ["host", "database", "user", "address", "auth-method", "auth-options"] ) {
                    if ( !access[name] ) continue;

                    line.push( access[name] );
                }

                config.push( line.join( " " ) );
            }
        }

        fs.writeFileSync( this.#cluster.dataDir + "/pg_hba.conf", config.join( "\n" ) );

        fs.chownSync( this.#cluster.dataDir + "/pg_hba.conf", uid, gid );
    }

    #writePostgresConfig () {

        // create "conf.d" dir
        if ( !fs.existsSync( this.#cluster.dataDir + "/conf.d" ) ) {
            fs.mkdirSync( this.#cluster.dataDir + "/conf.d", { "recursive": true } );
            fs.chownSync( this.#cluster.dataDir + "/conf.d", uid, gid );

            // move postgresql config
            fs.copyFileSync( this.#cluster.postgresqlConfigPath, this.#cluster.baseConfigPath );
            fs.chownSync( this.#cluster.baseConfigPath, uid, this.#cluster.gid );

            // rewrite postgresql config
            fs.writeFileSync( this.#cluster.postgresqlConfigPath, "include_dir = 'conf.d'" );
            fs.chownSync( this.#cluster.postgresqlConfigPath, uid, gid );
        }

        // generate default settings
        const settings = [];

        const config = this.config.settings;

        for ( const name in config ) {
            const value = config[name];

            if ( value == null ) {
                continue;
            }
            else if ( typeof value === "string" ) {
                settings.push( `${name} = '${value}'` );
            }
            else {
                settings.push( `${name} = ${value}` );
            }
        }

        fs.writeFileSync( this.#cluster.userConfigPath, settings.join( "\n" ) );
        fs.chownSync( this.#cluster.userConfigPath, uid, gid );
    }

    #writeReplicationsConfig () {
        this.#cluster.deleteReplicationConfig();

        var replicationConfig = "";

        // primary
        if ( this.isPrimary ) {
            if ( this.config.replication?.sync?.numberOfStandbys ) {
                replicationConfig += `synchronous_standby_names = 'FIRST ${this.config.replication.sync.numberOfStandbys} ( * )'\n`;
            }
        }

        // sync stanby
        else if ( this.isSyncStandby ) {
            replicationConfig += `primary_conninfo = 'host=${this.replicationHostname} port=${this.config.replication.port} user=${this.config.replication.username} password=${this.config.replication.password} application_name=${this.standbyId}'\n`;

            // NOTE if slot is used
            // replicationConfig += `primary_slot_name = '${this.standbyId}'\n`;
        }

        // async or backup standby
        else {
            replicationConfig += `primary_conninfo = 'host=${this.replicationHostname} port=${this.config.replication.port} user=${this.config.replication.username} password=${this.config.replication.password}'\n`;

            // NOTE if slot is used
            // replicationConfig += `primary_slot_name = '${this.standbyId}'\n`;
        }

        fs.writeFileSync( this.#cluster.replicationConfigPath, replicationConfig );
        fs.chownSync( this.#cluster.replicationConfigPath, uid, gid );
    }

    async #initPrimary () {
        var res;

        this.#cluster.deleteReplicationConfig();

        res = await this.#cluster.start( {
            "network": false,
            "standby": false,
        } );
        if ( !res.ok ) return res;

        const dbh = await sql.new( "postgresql:?maxConnections=1" );

        res = await dbh.exec( sql`

-- replication role
DROP ROLE IF EXISTS`.ID( this.#config.replication.username ).sql`;

CREATE ROLE`.ID( this.#config.replication.username ).sql`WITH REPLICATION LOGIN;

ALTER ROLE`.ID( this.#config.replication.username ).sql`WITH PASSWORD ${this.#config.replication.password};
` );

        dbh.destroy();

        await this.#cluster.shutDown();

        return res;
    }

    // XXX
    #startBackupCron () {

        // backups are disabled
        if ( !this.#config.backup || !this.#config.backup.cron || !this.#config.backup.numnerOfBackups || !this.#config.replication?.username ) {
            return;
        }

        // baclup on primary
        if ( this.config.backup.backupOn === "primary" ) {

            // backups are disabled on this node
            if ( !this.isPrimary ) {
                if ( !this.isBackupStandby ) this.#deleteBackups( true );

                return;
            }
        }

        // backup on backup standby
        else {

            // backups are disabled on this node
            if ( !this.isBackupStandby ) {
                this.#deleteBackups( true );

                return;
            }
        }

        this.#backupCron = new Cron( "0 * * * *", {
            "runMissed": true,
        } )
            .on( "tick", this.#makeBackup.bind( this ) )
            .unref()
            .start();
    }

    // XXX
    async #makeBackup () {
        const date = new Date(),
            tags = ["hourly"];

        if ( date.getHours() === 0 ) {
            tags.push( "daily" );

            if ( date.getDay() === 0 ) tags.push( "weekly" );

            if ( date.getDate() === 1 ) tags.push( "mnthly" );
        }

        const res = await this.#cluster.makeBackup();

        console.log( res + "" );

        if ( !res.ok ) return res;

        // delete old backups
        this.#deleteBackups();

        return res;
    }

    #deleteBackups ( all ) {
        if ( !fs.existsSync( this.#cluster.backupsDir ) ) return;

        const backups = fs.readdirSync( this.#cluster.backupsDir ).sort().reverse();

        const backupsToDelete = all ? backups : backups.slice( this.#config.backup?.numnerOfBackups );

        for ( const backupId of backupsToDelete ) {
            fs.rmSync( path.join( this.#cluster.backupsDir, backupId ), { "force": true, "recursive": true } );

            console.log( `Backup removed:`, backupId );
        }
    }

    #onClusterShutdown ( code, signal ) {
        console.log( `PostgreSQL process exited, code: ${code}` );

        process.shutDown( { code } );
    }
}
