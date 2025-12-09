import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Events from "#lib/events";
import { pathExists, pathExistsSync } from "#lib/fs";
import sql from "#lib/sql";
import Signal from "#lib/threads/signal";
import { TmpFile } from "#lib/tmp";
import utils from "./utils.js";

export default class PostgreSqlCluster extends Events {
    #id;
    #postgresql;
    #name;
    #version;
    #binDir;
    #dataDir;
    #backupsDir;
    #configPath;
    #autoConfigPath;
    #recoverySignalPath;
    #standbySignalPath;
    #defaultConfigPath;
    #userConfigPath;
    #replicationConfigPath;
    #recoveryConfigPath;
    #proc;
    #onExitCallback;
    #stopSignal = new Signal();

    constructor ( postgresql, version, name ) {
        super();

        this.#postgresql = postgresql;
        this.#name = name;
        this.#version = Number( version );

        this.#binDir = path.join( "/usr/lib/postgresql", String( this.#version ), "bin" );
        this.#dataDir = path.join( this.#postgresql.dataDir, "clusters", String( this.#version ), this.#name );
        this.#backupsDir = path.join( this.#postgresql.dataDir, "backups", String( this.#version ), this.#name );

        this.#configPath = this.#dataDir + "/postgresql.conf";
        this.#autoConfigPath = this.#dataDir + "/postgresql.auto.conf";
        this.#recoverySignalPath = this.#dataDir + "/recovery.signal";
        this.#standbySignalPath = this.#dataDir + "/standby.signal";
        this.#defaultConfigPath = this.#dataDir + "/conf.d/0-postgresql.conf";
        this.#userConfigPath = this.#dataDir + "/conf.d/10-user.conf";
        this.#replicationConfigPath = this.#dataDir + "/conf.d/20-replication.conf";
        this.#recoveryConfigPath = this.#dataDir + "/conf.d/30-recovery.conf";
    }

    // properties
    get postgresql () {
        return this.#postgresql;
    }

    get config () {
        return this.#postgresql.config;
    }

    get id () {
        this.#id ??= this.#postgresql.app.env.instanceId.replaceAll( "-", "_" );

        return this.#id;
    }

    get name () {
        return this.#name;
    }

    get version () {
        return this.#version;
    }

    get isExists () {
        return pathExistsSync( this.dataDir + "/PG_VERSION" );
    }

    get binIsExists () {
        return pathExistsSync( this.#binDir );
    }

    get isStarted () {
        return Boolean( this.#proc );
    }

    get binDir () {
        return this.#binDir;
    }

    get dataDir () {
        return this.#dataDir;
    }

    get backupsDir () {
        return this.#backupsDir;
    }

    get autoConfigPath () {
        return this.#autoConfigPath;
    }

    // public
    async startPrimary () {
        var res;

        // init data dir
        res = await this.#initDataDir();
        if ( !res.ok ) return res;

        // init cluster db
        if ( !this.isExists ) {
            res = await this.#initDb();
            if ( !res.ok ) return res;
        }

        // write configs
        await this.#writeHbaConfig();
        await this.#writeUserConfig();

        // update replication role
        res = await this.#initPrimary();
        if ( !res.ok ) return res;

        // write configs
        await this.#writeReplicationConfig();

        // start server
        res = await this.#start( {
            "network": true,
        } );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async startStandby () {
        var res;

        // init data dir
        res = await this.#initDataDir();
        if ( !res.ok ) return res;

        // make base backup
        if ( !this.isExists ) {
            res = await this.#makeBaseBackup();
            if ( !res.ok ) return res;
        }
        else {
            await this.deleteReplicationConfig();

            res = childProcess.spawnSync(
                `${ this.#binDir }/pg_rewind`,
                [

                    //
                    "--target-pgdata",
                    this.#dataDir,
                    "--source-server",
                    `host=${ this.#postgresql.replicationHostname } port=${ this.#postgresql.config.replication.port } user=${ this.#postgresql.config.replication.username } dbname=postgres`,
                ],
                {
                    "stdio": "inherit",
                    "uid": utils.uid,
                    "gid": utils.gid,
                    "env": {
                        "PGPASSWORD": this.#postgresql.config.replication.password,
                    },
                }
            );

            if ( res.status ) {
                return result( 500 );
            }
        }

        // write configs
        await this.#writeHbaConfig();
        await this.#writeUserConfig();
        await this.#writeReplicationConfig();

        // start server
        res = await this.#start( {
            "network": true,
        } );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // XXX
    async startBackup () {
        var res;

        // init backups dir
        res = await this.#initBackupsDir();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // XXX
    async upgrade ( oldClusterVersion, clusterName ) {
        var res;

        clusterName ||= this.config.clusterName;

        const oldCluster = new this.constructor( this.postgresql, oldClusterVersion, clusterName );

        // check old cluster data dir is exitsts
        if ( !oldCluster.isExists ) {
            return result( [ 500, "Old postgres cluster not found" ] );
        }

        // check new cluster is not exists
        if ( this.isExists ) {
            console.log( `
========================================

New cluster data directory already exysts.
Remove it manually and try again:

rm -rf ${ this.dataDir }

========================================
` );

            return result( 500 );
        }

        // XXX
        res = await this.postgresql.init();
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
                    `postgresql-${ oldCluster.version }`,
                    process.env.POSTGIS_VERSION
                        ? [ `postgresql-${ oldCluster.version }-postgis-${ process.env.POSTGIS_VERSION }` ]
                        : [],
                ],
                {
                    "stdio": "inherit",
                }
            );
            if ( res.status ) return result( 500 );
        }

        // init new cluster
        res = await this.#initDb();
        if ( !res.ok ) return res;

        // XXX test, remove, if it is not possible to upgrade srandby
        // remove replication config, required if we upgrading standby
        await oldCluster.deleteReplicationConfig();

        // check
        res = childProcess.spawnSync(
            `${ this.binDir }/pg_upgrade`,
            [

                //
                "--check",
                `--old-bindir=${ oldCluster.binDir }`,
                `--new-bindir=${ this.binDir }`,
                `--old-datadir=${ oldCluster.dataDir }`,
                `--new-datadir=${ this.dataDir }`,
            ],
            {
                "cwd": this.dataDir,
                "stdio": "inherit",
                "uid": utils.uid,
                "gid": utils.gid,
            }
        );
        if ( res.status ) return result( 500 );

        // upgrade
        res = childProcess.spawnSync(
            `${ this.binDir }/pg_upgrade`,
            [

                //
                `--old-bindir=${ oldCluster.binDir }`,
                `--new-bindir=${ this.binDir }`,
                `--old-datadir=${ oldCluster.dataDir }`,
                `--new-datadir=${ this.dataDir }`,
                "--new-options=-c timescaledb.restoring=on''",
            ],
            {
                "cwd": this.dataDir,
                "stdio": "inherit",
                "uid": utils.uid,
                "gid": utils.gid,
            }
        );
        if ( res.status ) return result( 500 );

        // copy configs
        if ( await pathExists( oldCluster.autoConfigPath ) ) {
            await fs.promises.cp( oldCluster.autoConfigPath, this.autoConfigPath );
        }

        console.log( `
========================================

Cluster upgraded to the version: ${ this.version }.
Old cluster version ${ oldCluster.version } can be removed.

Run manually, aftes server started:

vacuumdb --all --analyze-in-stages --missing-stats-only
vacuumdb --all --analyze-only

========================================
` );

        return result( 200 );
    }

    async stop () {
        return this.stopFast();
    }

    async stopFast () {
        if ( !this.#proc ) return;

        this.#proc.kill( "SIGINT" );

        return this.#stopSignal.wait();
    }

    async stopSmart () {
        if ( !this.#proc ) return;

        this.#proc.kill( "SIGTERM" );

        return this.#stopSignal.wait();
    }

    async stopImmediate () {
        if ( !this.#proc ) return;

        this.#proc.kill( "SIGQUIT" );

        return this.#stopSignal.wait();
    }

    // XXX move to private???
    async deleteReplicationConfig () {
        await Promise.all( [

            //
            fs.promises.rm( this.#replicationConfigPath, { "force": true } ),
            fs.promises.rm( this.#standbySignalPath, { "force": true } ),
        ] );

        // remove replication auto config
        if ( await pathExists( this.autoConfigPath ) ) {
            const config = fs
                .readFileSync( this.autoConfigPath, "utf8" )
                .split( "\n" )
                .map( line => line.trim() )
                .filter( line => {
                    if ( line.startsWith( "primary_conninfo" ) ) return false;

                    if ( line.startsWith( "primary_slot_name" ) ) return false;

                    return true;
                } )
                .join( "\n" );

            await utils.writeFile( this.autoConfigPath, config );
        }
    }

    // XXX review
    async writeReRecoveryConfig () {
        await this.deleteRecoveryConfig();

        const config = {

            // XXX recovery_target_time = 'YYYY-MM-DD HH:MM:SS' # Or recovery_target_xid, recovery_target_name, etc.
            "recovery_target_time": "",

            // "restore_command": `gunzip -c ${ this.backup.walsDir }/%f.gz > %p`,
            // "restore_command": `curl "http://postgres-backup:81/rpc/postgresql/get-wal?file=%f" --output "%p"`,
            // "recovery_end_command": null,
            "recovery_target_inclusive": true,
        };

        if ( await utils.writeConfig( this.#recoveryConfigPath, config ) ) {

            // create recovery.signal
            await utils.writeFile( this.recoverySignalPath, "" );
        }
    }

    // XXX review
    async deleteRecoveryConfig () {
        return Promise.all( [

            //
            fs.promises.rm( this.#recoverySignalPath, { "force": true } ),
            fs.promises.rm( this.#recoveryConfigPath, { "force": true } ),
        ] );
    }

    // private
    async #initDataDir () {

        // init data dir
        await fs.promises.mkdir( this.dataDir, { "recursive": true } );
        await utils.chmodDir( this.dataDir, { "recursive": true } );

        return result( 200 );
    }

    async #initBackupsDir () {

        // init backups dir
        await fs.promises.mkdir( this.backupsDir, { "recursive": true } );
        await utils.chmodDir( this.backupsDir, { "recursive": true } );

        return result( 200 );
    }

    async #initConfigDir () {

        // create "conf.d" dir
        if ( !( await pathExists( this.dataDir + "/conf.d" ) ) ) {
            await fs.promises.mkdir( this.dataDir + "/conf.d", { "recursive": true } );
            await utils.chmodDir( this.dataDir + "/conf.d" );

            // move postgresql config
            await fs.promises.rename( this.#configPath, this.#defaultConfigPath );
            await utils.chmodFile( this.#defaultConfigPath );

            // rewrite postgresql config
            await utils.writeFile( this.#configPath, "include_dir = 'conf.d'\n" );
        }
    }

    async #initDb () {
        if ( this.isExists ) return result( [ 500, "Cluster already exists" ] );

        const password = crypto.randomBytes( 16 ).toString( "base64url" );

        const passwordFile = new TmpFile();
        await utils.writeFile( passwordFile.path, password );

        var res = childProcess.spawnSync(
            `${ this.binDir }/initdb`,
            [

                //
                "--encoding=UTF8",
                "--no-locale",
                "-U",
                "postgres",
                `--pwfile=${ passwordFile }`,
                `--pgdata=${ this.dataDir }`,
            ],
            {
                "uid": utils.uid,
                "gid": utils.gid,
            }
        );

        if ( res.status ) {
            res = result( 500 );
        }
        else {
            res = result( 200, { password } );
        }

        await passwordFile.destroy();

        return res;
    }

    async #initPrimary () {
        var res;

        await this.deleteReplicationConfig();

        res = await this.#start( {
            "network": false,
        } );
        if ( !res.ok ) return res;

        const dbh = this.#createDbh();

        res = await dbh.exec( sql`

-- replication role
-- DROP ROLE IF EXISTS`.ID( this.config.replication.username ).sql`;

-- CREATE ROLE`.ID( this.config.replication.username ).sql`WITH REPLICATION LOGIN;
DO
$do$
BEGIN
    IF NOT EXISTS ( SELECT FROM pg_catalog.pg_roles WHERE rolname = ${ this.config.replication.username } ) THEN
        CREATE ROLE`.ID( this.config.replication.username ).sql`WITH REPLICATION LOGIN;
    END IF;
END
$do$;

ALTER ROLE`.ID( this.config.replication.username ).sql`WITH PASSWORD ${ this.config.replication.password };

-- pg_rewind permissions
GRANT EXECUTE ON function pg_catalog.pg_ls_dir ( text, boolean, boolean ) TO`.ID( this.config.replication.username ).sql`;
GRANT EXECUTE ON function pg_catalog.pg_stat_file ( text, boolean ) TO`.ID( this.config.replication.username ).sql`;
GRANT EXECUTE ON function pg_catalog.pg_read_binary_file ( text ) TO`.ID( this.config.replication.username ).sql`;
GRANT EXECUTE ON function pg_catalog.pg_read_binary_file ( text, bigint, bigint, boolean ) TO`.ID( this.config.replication.username ).sql`;
` );

        await dbh.destroy();

        await this.stop();

        return res;
    }

    async #makeBaseBackup () {
        var res;

        const dbh = this.#createDbh( { "replication": true } );

        // wait for primary up
        await dbh.waitConnect();

        // get replication slot
        res = await dbh.selectRow( sql`SELECT * FROM pg_replication_slots WHERE slot_name = ?`, [ this.id ] );

        // delete replication slot if exists
        if ( res.data ) {
            res = await dbh.selectRow( sql`SELECT pg_drop_replication_slot( ? )`, [ this.id ] );
        }

        await dbh.destroy();

        if ( !res.ok ) return res;

        res = childProcess.spawnSync(
            `${ this.#binDir }/pg_basebackup`,
            [

                //
                "--host=" + this.#postgresql.replicationHostname,
                "--port=" + this.#postgresql.config.replication.port,
                "--pgdata=" + this.#dataDir,
                "--username=" + this.#postgresql.config.replication.username,
                "--no-password",
                "--wal-method=stream",

                "--create-slot",
                "--slot=" + this.id,

                // "--progress",
                // "--verbose",
                // "--write-recovery-conf",
            ],
            {
                "stdio": "inherit",
                "uid": utils.uid,
                "gid": utils.gid,
                "env": {
                    "PGPASSWORD": this.#postgresql.config.replication.password,
                },
            }
        );

        if ( res.status ) {
            return result( 500 );
        }
        else {
            return result( 200 );
        }
    }

    async #writeHbaConfig ( { replication } = {} ) {
        const config = [];

        // generate pg_hba.conf
        for ( const access of this.config.access ) {
            const line = [];

            // replication mode
            if ( replication ) {
                if ( access.host !== "local" && access.user !== this.config.replication.username ) {
                    continue;
                }
            }

            for ( const name of [ "host", "database", "user", "address", "auth-method", "auth-options" ] ) {
                if ( !access[ name ] ) continue;

                line.push( access[ name ] );
            }

            config.push( line.join( " " ) );
        }

        await utils.writeFile( this.dataDir + "/pg_hba.conf", config.join( "\n" ) + "\n" );
    }

    async #writeUserConfig () {
        await this.#initConfigDir();

        // generate user config
        return utils.writeConfig( this.#userConfigPath, this.config.settings );
    }

    async #writeReplicationConfig () {
        await this.deleteReplicationConfig();

        var config;

        // primary
        if ( this.postgresql.isPrimary ) {
            config = {
                "wal_level": "replica",
            };

            if ( this.config.backup.enabled ) {
                config.summarize_wal = true;

                // XXX incremental_timeout * 2
                // minutes, 10 days
                // config.wal_summary_keep_time = 14_400

                // // PITR
                if ( this.config.backup.pitrEnabled ) {

                    // config.archive_mode = true;
                    // config.archive_command = `gzip -9 -c %p > ${ this.backup.walsDir }/%f.gz`;
                }
            }

            let numberOfStandbys = 0;

            if ( this.config.replication?.sync?.numberOfStandbys ) {
                numberOfStandbys += this.config.replication.sync.numberOfStandbys;
            }

            if ( this.config.backup?.enabled && this.config.backup?.pitrEnabled ) {
                numberOfStandbys += 1;
            }

            if ( numberOfStandbys ) {
                config.synchronous_standby_names = `${ numberOfStandbys } ( * )`;
            }
        }

        // sync stanby
        else if ( this.postgresql.isSyncStandby ) {
            config = {
                "primary_conninfo": `host=${ this.postgresql.replicationHostname } port=${ this.config.replication.port } user=${ this.config.replication.username } password=${ this.config.replication.password } application_name=${ this.id }`,

                "primary_slot_name": this.id,
            };
        }

        // async standby
        else {
            config = {
                "primary_conninfo": `host=${ this.postgresql.replicationHostname } port=${ this.config.replication.port } user=${ this.config.replication.username } password=${ this.config.replication.password } application_name=${ this.id }`,

                "primary_slot_name": this.id,
            };
        }

        if ( await utils.writeConfig( this.#replicationConfigPath, config ) ) {

            // write standby.signal
            if ( !this.postgresql.isPrimary ) {
                await utils.writeFile( this.#standbySignalPath, "" );
            }
        }
    }

    async #start ( { network = true } = {} ) {

        // already started
        if ( this.#proc ) return result( 500 );

        const listen = network
            ? "0.0.0.0"
            : "127.0.0.1";

        this.#proc = childProcess.spawn(
            `${ this.#binDir }/postgres`,
            [

                //
                "-D",
                this.#dataDir,
                "-k",
                this.#postgresql.unixSocketDir,
                "-h",
                listen,
            ],
            {
                "uid": utils.uid,
                "gid": utils.gid,
                "stdio": "inherit",
                "detached": true,
            }
        );

        this.#onExitCallback ??= () => this.#proc?.kill( "SIGINT" );
        process.once( "exit", this.#onExitCallback );

        this.#proc.on( "exit", this.#onPostgreSqlExit.bind( this ) );

        const res = await this.#checkReady();

        if ( !res.ok ) {
            await this.stop();
        }

        return res;
    }

    #createDbh ( { replication } = {} ) {
        const url = new URL( "postgresql://" ),
            options = {
                "maxConnections": 1,
            };

        if ( replication ) {
            url.hostname = this.postgresql.replicationHostname;
            url.port = this.config.replication.port;

            options.username = this.config.replication.username;
            options.password = this.config.replication.password;
            options.database = "postgres";
        }

        return sql.new( url, options );
    }

    async #checkReady () {
        const dbh = this.#createDbh();

        await dbh.waitConnect();

        await dbh.destroy();

        return result( 200 );
    }

    #onPostgreSqlExit ( code, signal ) {
        this.#proc = null;

        process.off( "exit", this.#onExitCallback );

        this.emit( "stop", code, signal );

        this.#stopSignal.broadcast();
    }
}
