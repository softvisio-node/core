import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Events from "#lib/events";
import { exists } from "#lib/fs";
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
    #configPath;
    #autoConfigPath;
    #recoverySignalPath;
    #standbySignalPath;
    #defaultConfigPath;
    #userConfigPath;
    #replicationConfigPath;
    #backupConfigPath;
    #recoveryConfigPath;
    #proc;
    #onExitCallback;
    #stopSignal = new Signal();

    constructor ( postgresql, version, name ) {
        super();

        this.#postgresql = postgresql;
        this.#name = name;
        this.#version = +version;

        this.#binDir = `/usr/lib/postgresql/${ this.#version }/bin`;
        this.#dataDir = path.join( this.#postgresql.clustersDir, this.#version + "", this.#name );

        this.#configPath = this.#dataDir + "/postgresql.conf";
        this.#autoConfigPath = this.#dataDir + "/postgresql.auto.conf";
        this.#recoverySignalPath = this.#dataDir + "/recovery.signal";
        this.#standbySignalPath = this.#dataDir + "/standby.signal";
        this.#defaultConfigPath = this.#dataDir + "/conf.d/0-postgresql.conf";
        this.#userConfigPath = this.#dataDir + "/conf.d/10-user.conf";
        this.#replicationConfigPath = this.#dataDir + "/conf.d/20-replication.conf";
        this.#backupConfigPath = this.#dataDir + "/conf.d/30-backup.conf";
        this.#recoveryConfigPath = this.#dataDir + "/conf.d/40-recovery.conf";
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
        return fs.existsSync( this.dataDir + "/PG_VERSION" );
    }

    get binIsExists () {
        return fs.existsSync( this.#binDir );
    }

    get isStarted () {
        return !!this.#proc;
    }

    get binDir () {
        return this.#binDir;
    }

    get dataDir () {
        return this.#dataDir;
    }

    get autoConfigPath () {
        return this.#autoConfigPath;
    }

    // public
    async init () {
        await fs.promises.mkdir( this.dataDir, { "recursive": true } );

        await utils.chmodDir( this.dataDir, { "recursive": true } );

        return result( 200 );
    }

    async start ( { network = true } = {} ) {

        // already started
        if ( this.#proc ) return result( 500 );

        const listen = network
            ? "0.0.0.0"
            : "127.0.0.1";

        // create and prepare unix socket dir
        await fs.promises.mkdir( this.#postgresql.unixSocketDir, { "recursive": true } );
        await utils.chmodDir( this.#postgresql.unixSocketDir );

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

    async initDb () {
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

        passwordFile.destroy();

        return res;
    }

    async makeBaseBackup () {
        var res;

        const url = new URL( "postgresql://" );
        url.hostname = this.#postgresql.replicationHostname;
        url.port = this.#postgresql.config.replication.port;

        const dbh = sql.new( url, {
            "username": this.#postgresql.config.replication.username,
            "password": this.#postgresql.config.replication.password,
            "database": "postgres",
        } );

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

    async deleteBackupConfig () {
        return fs.promises.rm( this.#backupConfigPath, { "force": true } );
    }

    async deleteRecoveryConfig () {
        return Promise.all( [

            //
            fs.promises.rm( this.#recoverySignalPath, { "force": true } ),
            fs.promises.rm( this.#recoveryConfigPath, { "force": true } ),
        ] );
    }

    async deleteReplicationConfig () {
        await fs.promises.rm( this.#replicationConfigPath, { "force": true } );
        await fs.promises.rm( this.#standbySignalPath, { "force": true } );

        // remove replication auto config
        if ( await exists( this.autoConfigPath ) ) {
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

    async writeHbaConfig () {
        const config = [];

        // generate pg_hba.conf
        if ( this.config.access ) {
            for ( const access of this.config.access ) {
                const line = [];

                for ( const name of [ "host", "database", "user", "address", "auth-method", "auth-options" ] ) {
                    if ( !access[ name ] ) continue;

                    line.push( access[ name ] );
                }

                config.push( line.join( " " ) );
            }
        }

        await utils.writeFile( this.dataDir + "/pg_hba.conf", config.join( "\n" ) + "\n" );
    }

    async writeUserConfig () {
        await this.#initConfig();

        // generate user config
        return utils.writeConfig( this.#userConfigPath, this.config.settings );
    }

    async writeReplicationConfig () {
        await this.deleteReplicationConfig();

        var config;

        // primary
        if ( this.postgresql.isPrimary ) {
            if ( this.config.replication?.sync?.numberOfStandbys ) {
                config = {
                    "synchronous_standby_names": `FIRST ${ this.config.replication.sync.numberOfStandbys } ( * )`,
                };
            }
        }

        // sync stanby
        else if ( this.postgresql.isSyncStandby ) {
            config = {
                "primary_conninfo": `host=${ this.replicationHostname } port=${ this.config.replication.port } user=${ this.config.replication.username } password=${ this.config.replication.password } application_name=${ this.id }`,

                "primary_slot_name": this.id,
            };
        }

        // async standby
        else {
            config = {
                "primary_conninfo": `host=${ this.replicationHostname } port=${ this.config.replication.port } user=${ this.config.replication.username } password=${ this.config.replication.password } application_name=${ this.id }`,

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

    // XXX
    async writeBackupConfig () {
        this.deleteBackupConfig();

        if ( !this.postgresql.isPrimary ) return;

        if ( !this.config.backup.enabled ) return;

        // const config = {
        //     "wal_level": "replica",
        //     "summarize_wal": true,
        //     "# wal_summary_keep_time": 14_400, // minutes, 10 days
        // };

        // // PITR
        // if ( this.config.backup.pitrEnabled ) {
        //     config.archive_mode = true;
        //     config.archive_command = `gzip -9 -c %p > ${ this.backup.walsDir }/%f.gz`;
        // }

        // return utils.writeConfig( this.#backupConfigPath, config );
    }

    // XXX
    async writeReRecoveryConfig () {
        await this.deleteRecoveryConfig();

        const config = {

            // XXX recovery_target_time = 'YYYY-MM-DD HH:MM:SS' # Or recovery_target_xid, recovery_target_name, etc.
            "recovery_target_time": "",

            "restore_command": `gunzip -c ${ this.backup.walsDir }/%f.gz > %p`,
            "recovery_target_inclusive": true,
        };

        if ( await utils.writeConfig( this.#recoveryConfigPath, config ) ) {

            // create recovery.signal
            await utils.writeFile( this.recoverySignalPath, "" );
        }
    }

    // private
    async #initConfig () {

        // create "conf.d" dir
        if ( !( await exists( this.dataDir + "/conf.d" ) ) ) {
            await fs.promises.mkdir( this.dataDir + "/conf.d", { "recursive": true } );
            await utils.chmodDir( this.dataDir + "/conf.d" );

            // move postgresql config
            await fs.promises.rename( this.#configPath, this.#defaultConfigPath );
            await utils.chmodFile( this.#defaultConfigPath );

            // rewrite postgresql config
            await utils.writeFile( this.#configPath, "include_dir = 'conf.d'\n" );
        }
    }

    async #checkReady () {
        const dbh = sql.new( "postgresql:?maxConnections=1" );

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
