import Events from "#core/events";
import fs from "node:fs";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import sql from "#core/sql";
import Signal from "#core/threads/signal";
import uuidV4 from "#core/uuid";
import env from "#core/env";
import path from "node:path";
import Cron from "#core/cron";
import Mutex from "#core/threads/mutex";

// https://www.postgresql.org/docs/current/server-shutdown.html

export default class PostgreSql extends Events {
    #app;
    #config;
    #standby;

    #dataRoot;
    #dataDir;
    #backupDir;
    #unixSocketDirectories;
    #uid;
    #gid;

    #standbyId;
    #replicationHostname;

    #proc;
    #backupCron;
    #backupMutex = new Mutex();
    #isStarted;
    #shutdownSignal = new Signal();

    constructor ( app, config, { standby } = {} ) {
        super();

        this.#app = app;
        this.#config = config;
        this.#standby = standby;
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get isStarted () {
        return this.#isStarted;
    }

    get isPrimary () {
        return !this.#standby;
    }

    get isSyncStandby () {
        return this.#standby === "sync";
    }

    get isAsyncStandby () {
        return this.#standby === "async";
    }

    get isBackupStandby () {
        return this.#standby === "backup";
    }

    get standbyId () {
        this.#standbyId ??= uuidV4().replaceAll( "-", "_" );

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
    async start () {
        const res = this.#init();
        if ( !res.ok ) return res;

        if ( this.#isStarted ) return result( 200 );
        this.#isStarted = true;

        // init primary
        if ( this.isPrimary ) {
            await this.#initPrimary();
        }

        // ini standby
        else {
            await this.#initStandby();
        }

        // start server
        this.#proc = childProcess.spawn( "postgres", ["-D", this.#dataDir, "-k", this.#unixSocketDirectories, "-h", "0.0.0.0"], {
            "encoding": "utf8",
            "uid": this.#uid,
            "gid": this.#gid,
            "stdio": "inherit",
            "detached": true,
        } );

        this.#proc.on( "exit", this.#onProcExit.bind( this ) );

        // init backup
        this.#startBackup();

        console.log( `PostgreSQL process started` );

        return result( 200 );
    }

    async smartShutDown () {
        if ( !this.#isStarted ) return;

        console.log( "PostgreSQL smart shutting down" );

        this.#proc.kill( "SIGTERM" );

        return this.#shutdownSignal.wait();
    }

    async fastShutDown () {
        if ( !this.#isStarted ) return;

        console.log( "PostgreSQL fast shutting down" );

        this.#proc.kill( "SIGINT" );

        return this.#shutdownSignal.wait();
    }

    async immediateShutDown () {
        if ( !this.#isStarted ) return;

        console.log( "PostgreSQL immediate shutting down started" );

        this.#proc.kill( "SIGQUIT" );

        return this.#shutdownSignal.wait();
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

        this.#dataRoot = this.config.dataRoot || this.#app.env.dataDir + "/postgresql";
        if ( !path.isAbsolute( this.#dataRoot ) ) this.#dataRoot = path.join( env.root, this.#dataRoot );

        this.#dataDir = path.join( this.#dataRoot, this.config.postgresVersion + "", this.config.postgresClusterName );
        this.#unixSocketDirectories = "/var/run/postgresql";
        this.#backupDir = path.join( this.#dataRoot, `backup.${this.config.postgresVersion}.${this.config.postgresClusterName}` );

        this.#uid = +childProcess.execFileSync( "id", ["-u", "postgres"], { "encoding": "utf8" } ).trim();
        this.#gid = +childProcess.execFileSync( "id", ["-g", "postgres"], { "encoding": "utf8" } ).trim();

        fs.mkdirSync( this.#dataRoot, { "recursive": true } );
        fs.chownSync( this.#dataRoot, this.#uid, this.#gid );
        fs.chmodSync( this.#dataRoot, 0o700 );

        fs.mkdirSync( this.#dataDir, { "recursive": true } );
        fs.chownSync( this.#dataDir, this.#uid, this.#gid );
        fs.chmodSync( this.#dataDir, 0o700 );

        // create and prepare unix socket dir
        if ( !fs.existsSync( this.#unixSocketDirectories ) ) {
            fs.mkdirSync( this.#unixSocketDirectories, { "recursive": true } );
        }
        fs.chownSync( this.#unixSocketDirectories, this.#uid, this.#gid );

        return result( 200 );
    }

    async #initPrimary () {
        fs.rmSync( this.#dataDir + "/standby.signal", { "force": true } );

        // init db
        if ( !fs.existsSync( this.#dataDir + "/PG_VERSION" ) ) {
            const pwfile = "/tmp/postgresql-password.txt";

            const superuserPassword = crypto.randomBytes( 16 ).toString( "base64url" );

            console.log( `GENERATED POSTGRES PASSWORD: ${superuserPassword}` );

            fs.rmSync( pwfile, { "force": true } );
            fs.writeFileSync( pwfile, superuserPassword );
            fs.chownSync( pwfile, this.#uid, this.#gid );

            childProcess.execFileSync( "initdb", ["--encoding", "UTF8", "--no-locale", "-U", "postgres", "--pwfile", pwfile, "-D", this.#dataDir], {
                "encoding": "utf8",
                "uid": this.#uid,
                "gid": this.#gid,
            } );

            fs.rmSync( pwfile, { "force": true } );
        }

        // write hba config
        this.#writeHbaConfig();

        // write postgres config
        this.#writePostgresConfig();

        this.#writeReplicationsConfig( true );

        // update extensions
        await this.#updatePrimary();

        this.#writeReplicationsConfig();
    }

    async #initStandby () {

        // base backup
        if ( !fs.existsSync( this.#dataDir + "/PG_VERSION" ) ) {
            childProcess.execFileSync(
                "pg_basebackup",
                [

                    //
                    "--host=" + this.replicationHostname,
                    "--pgdata=" + this.#dataDir,
                    "--username=" + this.#config.replication.username,
                    "--progress",
                    "--verbose",
                    "--write-recovery-conf",
                    "--wal-method=stream",
                    "--no-password",

                    // "--create-slot",
                    // "--slot=" + this.standbyId,
                ],
                {
                    "encoding": "utf8",
                    "uid": this.#uid,
                    "gid": this.#gid,
                    "env": {
                        "PGPASSWORD": this.#config.replication.password,
                    },
                }
            );
        }

        // write hba config
        this.#writeHbaConfig();

        // write postgres config
        this.#writePostgresConfig();

        fs.writeFileSync( this.#dataDir + "/standby.signal", "" );

        this.#writeReplicationsConfig();
    }

    async #updatePrimary () {
        const proc = childProcess.spawn( "postgres", ["-D", this.#dataDir, "-k", this.#unixSocketDirectories], {
            "encoding": "utf8",
            "uid": this.#uid,
            "gid": this.#gid,
            "stdio": "inherit",
            "detached": true,
        } );

        // wait for server is ready
        while ( 1 ) {
            const res = childProcess.spawnSync( "pg_isready", null, { "encoding": "utf8", "stdio": "inherit" } );

            if ( !res.status ) break;

            await new Promise( resolve => setTimeout( resolve, 1000 ) );
        }

        const dbh = await sql.new( "pgsql://postgres@unix/var/run/postgresql/.s.PGSQL.5432" );

        const res = await dbh.exec( sql`
CREATE EXTENSION IF NOT EXISTS softvisio_admin CASCADE;
ALTER EXTENSION softvisio_admin UPDATE;
CALL update_extensions();

-- replication role
DROP ROLE IF EXISTS`.ID( this.#config.replication.username ).sql`;
CREATE ROLE`.ID( this.#config.replication.username ).sql`WITH REPLICATION LOGIN;
ALTER ROLE`.ID( this.#config.replication.username ).sql`WITH PASSWORD ${this.#config.replication.password};
` );

        console.log( `Updating extensions ... ${res}` );

        return new Promise( resolve => {
            proc.on( "exit", resolve );

            proc.kill( "SIGINT" );
        } );
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

        fs.writeFileSync( this.#dataDir + "/pg_hba.conf", config.join( "\n" ) );

        fs.chownSync( this.#dataDir + "/pg_hba.conf", this.#uid, this.#gid );
    }

    #writePostgresConfig () {

        // create "conf.d" dir
        if ( !fs.existsSync( this.#dataDir + "/conf.d" ) ) {
            fs.mkdirSync( this.#dataDir + "/conf.d", { "recursive": true } );
            fs.chownSync( this.#dataDir + "/conf.d", this.#uid, this.#gid );

            // move "postgresql.conf"
            fs.copyFileSync( this.#dataDir + "/postgresql.conf", this.#dataDir + "/conf.d/0-postgresql.conf" );
            fs.chownSync( this.#dataDir + "/conf.d/0-postgresql.conf", this.#uid, this.#gid );

            fs.writeFileSync( this.#dataDir + "/postgresql.conf", "include_dir = 'conf.d'" );
            fs.chownSync( this.#dataDir + "/postgresql.conf", this.#uid, this.#gid );
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

        fs.writeFileSync( this.#dataDir + "/conf.d/1-init.conf", settings.join( "\n" ) );
        fs.chownSync( this.#dataDir + "/conf.d/1-init.conf", this.#uid, this.#gid );
    }

    #writeReplicationsConfig ( clear ) {
        var replicationConfig = "";

        if ( !clear ) {

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
        }

        fs.writeFileSync( this.#dataDir + "/conf.d/2-replication.conf", replicationConfig );
        fs.chownSync( this.#dataDir + "/conf.d/2-replication.conf", this.#uid, this.#gid );

        const autoConfigPath = path.join( this.#dataDir, "postgresql.auto.conf" );

        if ( fs.existsSync( autoConfigPath ) ) {
            let config = fs.readFileSync( autoConfigPath, "utf8" );

            config = config
                .split( "\n" )
                .map( line => line.trim() )
                .filter( line => {
                    if ( line.startsWith( "primary_conninfo" ) ) return false;

                    if ( line.startsWith( "primary_slot_name" ) ) return false;

                    return true;
                } )
                .join( "\n" );

            fs.writeFileSync( autoConfigPath, config );
        }
    }

    #startBackup () {

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

        fs.mkdirSync( this.#backupDir, { "recursive": true } );
        fs.chownSync( this.#backupDir, this.#uid, this.#gid );
        fs.chmodSync( this.#backupDir, 0o700 );

        this.#backupCron = new Cron( this.#config.backup.cron, { "runMissed": true } ).on( "tick", this.#backup.bind( this ) ).unref().start();
    }

    async #backup () {
        if ( !this.#backupMutex.tryLock() ) return;

        const backupId = new Date().toISOString();

        await new Promise( resolve => {
            childProcess
                .execFile(
                    "pg_basebackup",
                    [

                        //
                        "--label=" + backupId,
                        "--pgdata=" + path.join( this.#backupDir, backupId ),
                        "--format=tar",
                        "--gzip",
                        "--username=" + this.#config.replication.username,

                        // "--progress",
                        // "--verbose",
                    ],
                    {
                        "encoding": "utf8",
                        "uid": this.#uid,
                        "gid": this.#gid,
                    }
                )
                .on( "exit", code => {
                    if ( code ) {
                        console.log( "Backup error, code:", code );
                    }
                    else {
                        console.log( `Backup created:`, backupId );
                    }

                    resolve();
                } );
        } );

        // delete old backups
        this.#deleteBackups();

        this.#backupMutex.unlock();
    }

    #deleteBackups ( all ) {
        if ( !fs.existsSync( this.#backupDir ) ) return;

        const backups = fs.readdirSync( this.#backupDir ).sort().reverse();

        const backupsToDelete = all ? backups : backups.slice( this.#config.backup?.numnerOfBackups );

        for ( const backupId of backupsToDelete ) {
            fs.rmSync( path.join( this.#backupDir, backupId ), { "force": true, "recursive": true } );

            console.log( `Backup removed:`, backupId );
        }
    }

    #onProcExit ( code, signal ) {
        this.#proc = null;
        this.#isStarted = false;

        console.log( `PostgreSQL process exited, code: ${code}` );

        process.exitCode = code;

        this.#shutdownSignal.broadcast();

        this.emit( "exit", code );
    }
}
