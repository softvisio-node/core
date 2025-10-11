import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Events from "#lib/events";
import { chmodSync } from "#lib/fs";
import sql from "#lib/sql";
import tar from "#lib/tar";
import Mutex from "#lib/threads/mutex";
import Signal from "#lib/threads/signal";
import { TmpDir, TmpFile } from "#lib/tmp";

export default class PostgreSqlCluster extends Events {
    #id;
    #postgresql;
    #name;
    #version;
    #binDir;
    #dataDir;
    #backupDir;
    #postgresqlConfigPath;
    #autoConfigPath;
    #recoverySignalPath;
    #standbySignalPath;
    #baseConfigPath;
    #userConfigPath;
    #replicationConfigPath;
    #backupConfigPath;
    #recoveryConfigPath;
    #backupMutex = new Mutex();
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
        this.#backupDir = path.join( this.#postgresql.backupsDir, this.#version + "", this.#name );

        this.#postgresqlConfigPath = this.#dataDir + "/postgresql.conf";
        this.#autoConfigPath = this.#dataDir + "/postgresql.auto.conf";
        this.#recoverySignalPath = this.#dataDir + "/recovery.signal";
        this.#standbySignalPath = this.#dataDir + "/standby.signal";
        this.#baseConfigPath = this.#dataDir + "/conf.d/0-postgresql.conf";
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

    get uid () {
        return this.#postgresql.uid;
    }

    get gid () {
        return this.#postgresql.gid;
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

    get backupDir () {
        return this.#backupDir;
    }

    get postgresqlConfigPath () {
        return this.#postgresqlConfigPath;
    }

    get autoConfigPath () {
        return this.#autoConfigPath;
    }

    get baseConfigPath () {
        return this.#baseConfigPath;
    }

    get userConfigPath () {
        return this.#userConfigPath;
    }

    get replicationConfigPath () {
        return this.#replicationConfigPath;
    }

    get backupConfigPath () {
        return this.#backupConfigPath;
    }

    get recoveryConfigPath () {
        return this.#recoveryConfigPath;
    }

    // public
    async start ( { standby, network = true } = {} ) {

        // already started
        if ( this.#proc ) return result( 500 );

        const listen = network
            ? "0.0.0.0"
            : "127.0.0.1";

        if ( standby ) {
            fs.writeFileSync( this.#standbySignalPath, "" );
        }
        else {
            this.deleteStandbysignal();
        }

        // create and prepare unix socket dir
        fs.mkdirSync( this.#postgresql.unixSocketDir, { "recursive": true } );
        fs.chownSync( this.#postgresql.unixSocketDir, this.#postgresql.uid, this.#postgresql.gid );

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
                "uid": this.#postgresql.uid,
                "gid": this.#postgresql.gid,
                "stdio": "inherit",
                "detached": true,
            }
        );

        this.#onExitCallback ??= () => this.#proc?.kill( "SIGINT" );
        process.once( "exit", this.#onExitCallback );

        this.#proc.on( "exit", this.#onPostgreSqlExit.bind( this ) );

        const res = await this.#checkReady();

        if ( !res.ok ) await this.stop();

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
        fs.writeFileSync( passwordFile.path, password );
        fs.chownSync( passwordFile.path, this.#postgresql.uid, this.#postgresql.gid );

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
                "uid": this.#postgresql.uid,
                "gid": this.#postgresql.gid,
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
                "uid": this.#postgresql.uid,
                "gid": this.#postgresql.gid,
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

    async makeBackup () {
        if ( !this.#backupMutex.tryLock() ) return;

        const tmpDir = new TmpDir();

        fs.chownSync( tmpDir.path, this.#postgresql.uid, this.#postgresql.gid );
        chmodSync( tmpDir.path, "rwx------" );

        const backupDate = new Date();

        var res = await new Promise( resolve => {
            childProcess
                .spawn(
                    `${ this.binDir }/pg_basebackup`,
                    [

                        //
                        "--label=" + backupDate.toISOString(),
                        "--pgdata=" + tmpDir.path,
                        "--format=tar",
                        "--gzip",
                        "--username=" + this.#postgresql.config.replication.username,
                        "--wal-method=stream",
                    ],
                    {
                        "stdio": "inherit",
                        "uid": this.#postgresql.uid,
                        "gid": this.#postgresql.gid,
                    }
                )
                .on( "exit", code => {
                    var res;

                    if ( code ) {
                        res = result( [ 500, `Backup error, code: ${ code }` ] );
                    }
                    else {
                        res = result( 200 );
                    }

                    resolve( res );
                } );
        } );

        if ( res.ok ) {
            const tmpFile = new TmpFile();

            await tar.create( {
                "cwd": tmpDir.path,
                "gzip": false,
                "portable": true,
                "file": tmpFile.path,
            } );

            tmpDir.destroy();

            res = result( 200, {
                "date": backupDate,
                "file": tmpFile,
            } );
        }

        this.#backupMutex.unlock();

        return res;
    }

    deleteBackupConfig () {
        fs.rmSync( this.backupConfigPath, { "force": true } );
    }

    deleteRecoveryConfig () {
        fs.rmSync( this.#recoverySignalPath, { "force": true } );

        fs.rmSync( this.recoveryConfigPath, { "force": true } );
    }

    deleteStandbysignal () {
        fs.rmSync( this.#standbySignalPath, { "force": true } );
    }

    deleteReplicationConfig () {
        fs.rmSync( this.replicationConfigPath, { "force": true } );

        // remove replication auto config
        if ( fs.existsSync( this.autoConfigPath ) ) {
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

            fs.writeFileSync( this.autoConfigPath, config );
        }
    }

    writeHbaConfig () {
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

        fs.writeFileSync( this.dataDir + "/pg_hba.conf", config.join( "\n" ) );

        fs.chownSync( this.dataDir + "/pg_hba.conf", this.uid, this.gid );
    }

    writeConfig () {
        this.#initConfig();

        // generate user config
        const config = this.#buildConfig( this.config.settings );

        if ( config ) {
            fs.writeFileSync( this.userConfigPath, config );
            fs.chownSync( this.userConfigPath, this.uid, this.gid );
        }
    }

    writeReplicationConfig () {
        this.deleteReplicationConfig();

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

        config = this.#buildConfig( config );

        if ( config ) {
            fs.writeFileSync( this.replicationConfigPath, config );
            fs.chownSync( this.replicationConfigPath, this.uid, this.gid );
        }
    }

    writeBackupConfig () {
        this.deleteBackupConfig();

        if ( !this.postgresql.isPrimary ) return;

        if ( !this.config.backup.enabled ) return;

        // primary
        var config = {
            "wal_level": "replica",
            "summarize_wal": true,
            "# wal_summary_keep_time": 14_400, // minutes, 10 days
        };

        // PITR
        if ( this.config.backup.pitrEnabled ) {
            config.archive_mode = true;
            config.archive_command = `test ! -f ${ this.backupDir }/wals/%f && cp %p ${ this.backupDir }/wals/%f`;

            // init backup dir
            this.#initBackupDir();
        }

        config = this.#buildConfig( config );

        if ( config ) {
            fs.writeFileSync( this.backupConfigPath, config.join( "\n" ) );
            fs.chownSync( this.backupConfigPath, this.uid, this.gid );
        }
    }

    // XXX
    writeReRecoveryConfig () {
        this.deleteRecoveryConfig();

        let config = {

            // XXX recovery_target_time = 'YYYY-MM-DD HH:MM:SS' # Or recovery_target_xid, recovery_target_name, etc.
            "recovery_target_time": "",

            "restore_command": `cp ${ this.backupDir }/wals/%f %p`,
            "recovery_target_inclusive": true,
        };

        config = this.#buildConfig( config );

        if ( config ) {
            fs.writeFileSync( this.recoveryConfigPath, config );
            fs.chownSync( this.recoveryConfigPath, this.uid, this.gid );

            // create recovery.signal
            fs.writeFileSync( this.recoverySignalPath, "" );
            fs.chownSync( this.recoverySignalPath, this.uid, this.gid );
        }
    }

    // private
    #initConfig () {

        // create "conf.d" dir
        if ( !fs.existsSync( this.dataDir + "/conf.d" ) ) {
            fs.mkdirSync( this.dataDir + "/conf.d", { "recursive": true } );
            fs.chownSync( this.dataDir + "/conf.d", this.uid, this.gid );

            // move postgresql config
            fs.copyFileSync( this.postgresqlConfigPath, this.baseConfigPath );
            fs.chownSync( this.baseConfigPath, this.uid, this.gid );

            // rewrite postgresql config
            fs.writeFileSync( this.postgresqlConfigPath, "include_dir = 'conf.d'" );
            fs.chownSync( this.postgresqlConfigPath, this.uid, this.gid );
        }
    }

    #initBackupDir () {
        fs.mkdirSync( this.backupDir + "/backups", { "recursive": true } );
        fs.chownSync( this.backupDir + "/backups", this.uid, this.gid );

        fs.mkdirSync( this.backupDir + "/wals", { "recursive": true } );
        fs.chownSync( this.backupDir + "/wals", this.uid, this.gid );

        fs.chownSync( this.backupDir, this.uid, this.gid );
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
