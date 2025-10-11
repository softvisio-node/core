import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import env from "#lib/env";
import { chmodSync, exists } from "#lib/fs";
import { globSync } from "#lib/glob";
import sql from "#lib/sql";
import PostgreSqlCluster from "./postgresql/cluster.js";

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
    #uid;
    #gid;

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

    get uid () {
        this.#uid ||= +childProcess.execFileSync( "id", [ "-u", "postgres" ], { "encoding": "utf8" } ).trim();

        return this.#uid;
    }

    get gid () {
        this.#gid ||= +childProcess.execFileSync( "id", [ "-g", "postgres" ], { "encoding": "utf8" } ).trim();

        return this.#gid;
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

        res = this.#init();
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
        this.#writeHbaConfig();

        // write postgres config
        this.#writePostgresConfig();

        // update replication role
        if ( this.isPrimary ) {
            res = await this.#initPrimary();
            if ( !res.ok ) return res;
        }

        this.#writeReplicationConfig();

        // start server
        res = await this.#cluster.start( {
            "network": true,
            "standby": !this.isPrimary,
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
        oldCluster.deleteStandbysignal();

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
                "uid": this.uid,
                "gid": this.gid,
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
                "uid": this.uid,
                "gid": this.gid,
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
    #init () {
        if ( this.isSyncStandby ) {
            if ( !this.config.replication?.sync?.numberOfStandbys ) {
                return result( [ 400, "Sync standbys are not enabled" ] );
            }
        }
        else if ( this.isAsyncStandby && this.config.replication?.async?.replicateFrom === "sync" && !this.config.replication?.sync?.numberOfStandbys ) {
            return result( [ 400, "Can't replicate from sync standby" ] );
        }

        fs.mkdirSync( this.#dataDir, { "recursive": true } );
        fs.mkdirSync( this.#cluster.dataDir, { "recursive": true } );

        // chown
        const files = globSync( "**", {
            "cwd": this.#dataDir,
            "directories": true,
        } );

        for ( const file of files ) {
            fs.chownSync( this.#dataDir + "/" + file, this.uid, this.gid );
            chmodSync( this.#dataDir + "/" + file, "rwx------" );
        }

        return result( 200 );
    }

    #writeHbaConfig () {
        const config = [];

        // generate pg_hba.conf
        if ( this.#config.access ) {
            for ( const access of this.#config.access ) {
                const line = [];

                for ( const name of [ "host", "database", "user", "address", "auth-method", "auth-options" ] ) {
                    if ( !access[ name ] ) continue;

                    line.push( access[ name ] );
                }

                config.push( line.join( " " ) );
            }
        }

        fs.writeFileSync( this.#cluster.dataDir + "/pg_hba.conf", config.join( "\n" ) );

        fs.chownSync( this.#cluster.dataDir + "/pg_hba.conf", this.uid, this.gid );
    }

    #writePostgresConfig () {

        // create "conf.d" dir
        if ( !fs.existsSync( this.#cluster.dataDir + "/conf.d" ) ) {
            fs.mkdirSync( this.#cluster.dataDir + "/conf.d", { "recursive": true } );
            fs.chownSync( this.#cluster.dataDir + "/conf.d", this.uid, this.gid );

            // move postgresql config
            fs.copyFileSync( this.#cluster.postgresqlConfigPath, this.#cluster.baseConfigPath );
            fs.chownSync( this.#cluster.baseConfigPath, this.uid, this.gid );

            // rewrite postgresql config
            fs.writeFileSync( this.#cluster.postgresqlConfigPath, "include_dir = 'conf.d'" );
            fs.chownSync( this.#cluster.postgresqlConfigPath, this.uid, this.gid );
        }

        // generate user config
        const config = this.#buildConfig( this.config.settings );

        if ( config ) {
            fs.writeFileSync( this.#cluster.userConfigPath, config );
            fs.chownSync( this.#cluster.userConfigPath, this.uid, this.gid );
        }
    }

    #writeReplicationConfig () {
        this.#cluster.deleteReplicationConfig();

        var config;

        // primary
        if ( this.isPrimary ) {
            if ( this.config.replication?.sync?.numberOfStandbys ) {
                config = {
                    "synchronous_standby_names": `FIRST ${ this.config.replication.sync.numberOfStandbys } ( * )`,
                };
            }
        }

        // sync stanby
        else if ( this.isSyncStandby ) {
            config = {
                "primary_conninfo": `host=${ this.replicationHostname } port=${ this.config.replication.port } user=${ this.config.replication.username } password=${ this.config.replication.password } application_name=${ this.#cluster.id }`,

                "primary_slot_name": this.#cluster.id,
            };
        }

        // async standby
        else {
            config = {
                "primary_conninfo": `host=${ this.replicationHostname } port=${ this.config.replication.port } user=${ this.config.replication.username } password=${ this.config.replication.password } application_name=${ this.#cluster.id }`,

                "primary_slot_name": this.#cluster.id,
            };
        }

        config = this.#buildConfig( config );

        if ( config ) {
            fs.writeFileSync( this.#cluster.replicationConfigPath, config );
            fs.chownSync( this.#cluster.replicationConfigPath, this.uid, this.gid );
        }
    }

    // XXX
    writeBackupConfig () {
        this.#cluster.deleteBackupConfig();

        // primary
        if ( this.isPrimary && this.config.backup.enabled ) {
            let config = {
                "wal_level": "replica",
                "summarize_wal": true,

                // "wal_summary_keep_time": 14_400, // minutes, 10 days
            };

            // XXX
            // PITR
            if ( this.config.backup.pitrEnabled ) {
                config.archive_mode = true;

                // XXX
                config.archive_command = "test ! -f /var/local/backup/wal/%f && cp %p /var/local/backup/wal/%f";
            }

            config = this.#buildConfig( config );

            if ( config ) {
                fs.writeFileSync( this.#cluster.backupConfigPath, config.join( "\n" ) );
                fs.chownSync( this.#cluster.backupConfigPath, this.uid, this.gid );
            }
        }
    }

    // XXX
    writeReRecoveryConfig () {
        this.#cluster.deleteRecoveryConfig();

        // primary
        if ( this.isPrimary ) {
            let config = {

                // XXX
                "restore_command": "cp /var/local/backup/wal/%f %p",

                // XXX recovery_target_time = 'YYYY-MM-DD HH:MM:SS' # Or recovery_target_xid, recovery_target_name, etc.
                "recovery_target_time": "",

                "recovery_target_inclusive": true,
            };

            config = this.#buildConfig( config );

            if ( config ) {
                fs.writeFileSync( this.#cluster.recoveryConfigPath, config );
                fs.chownSync( this.#cluster.recoveryConfigPath, this.uid, this.gid );
            }
        }
    }

    async #initPrimary () {
        var res;

        this.#cluster.deleteReplicationConfig();

        res = await this.#cluster.start( {
            "network": false,
            "standby": false,
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

    #buildConfig ( config ) {
        if ( !config ) return;

        const lines = [];

        for ( const name in config ) {
            const value = this.#quoteConfigValue( config[ name ] );

            if ( value == null ) {
                continue;
            }
            else {
                lines.push( `${ name } = ${ value }` );
            }
        }

        if ( lines.length ) {
            return lines.join( "\n" );
        }
    }

    #quoteConfigValue ( value ) {

        // null
        if ( value == null ) {
            return;
        }

        // string
        else if ( typeof value === "string" ) {
            const match = value.match( /^\s*(-?\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB|us|ms|s|min|h|d)\s*$/ );

            // number with unit
            if ( match ) {
                return `${ match[ 1 ] }${ match[ 2 ] }`;
            }

            // literal
            else {
                return `'${ value.replaceAll( "'", "''" ) }'`;
            }
        }

        // boolean
        else if ( typeof value === "boolean" ) {
            return value.toString();
        }

        // number
        else if ( typeof value === "number" ) {
            return value;
        }

        // array
        else if ( Array.isArray( value ) ) {
            return value
                .map( value => this.#quoteConfigValue( value ) )
                .filter( value => value )
                .join( ", " );
        }

        // other value
        else {
            throw new Error( `PostgreSQL config value "${ value }" is not valid` );
        }
    }
}
