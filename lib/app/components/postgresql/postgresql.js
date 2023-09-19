import fs from "node:fs";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import sql from "#lib/sql";
import Signal from "#lib/threads/signal";
import uuid from "#lib/uuid";
import env from "#lib/env";
import path from "node:path";
import Cron from "#lib/cron";
import Mutex from "#lib/threads/mutex";
import glob from "#lib/glob";

// NOTE https://www.postgresql.org/docs/current/server-shutdown.html

const CHECK_READY_TIMEOUT = 60_000;

export default class PostgreSql {
    #app;
    #config;

    #clusterVersion = process.env.POSTGRESQL_VERSION;
    #dataRoot;
    #binDir;
    #dataDir;
    #backupDir;
    #unixSocketDirectories;

    #baseConfigPath;
    #userConfigPath;
    #replicationConfigPath;

    #uid;
    #gid;

    #standbyId;
    #replicationHostname;

    #proc;
    #backupCron;
    #backupMutex = new Mutex();
    #isStarted;
    #shutdownSignal = new Signal();

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#binDir = `/usr/lib/postgresql/${this.#clusterVersion}/bin`;

        this.#dataRoot = this.config.dataRoot || this.app.env.dataDir + "/postgresql";
        if ( !path.isAbsolute( this.#dataRoot ) ) this.#dataRoot = path.join( env.root, this.#dataRoot );

        this.#dataDir = path.join( this.#dataRoot, this.#clusterVersion + "", this.config.clusterName );

        this.#unixSocketDirectories = "/var/run/postgresql";

        this.#backupDir = path.join( this.#dataRoot, this.#clusterVersion, `${this.config.clusterName}.backups` );

        this.#baseConfigPath = this.#dataDir + "/conf.d/0-postgresql.conf";
        this.#userConfigPath = this.#dataDir + "/conf.d/10-user.conf";
        this.#replicationConfigPath = this.#dataDir + "/conf.d/20-replication.conf";

        process.on( "exit", () => this.#proc?.kill( "SIGINT" ) );
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
    async upgrade ( oldVersion ) {
        var res;

        res = await this.#init();
        if ( !res.ok ) return res;

        const oldBinDir = `/usr/lib/postgresql/${oldVersion}/bin`,
            oldDataDir = path.join( this.#dataRoot, oldVersion + "", this.config.clusterName );

        // check old cluster data dir is exitsts
        if ( !fs.existsSync( oldDataDir ) ) {
            return result( [500, `Old postgres cluster not found`] );
        }

        // check new cluster is not exists
        if ( fs.existsSync( this.#dataDir + "/PG_VERSION" ) ) {
            console.log( `
========================================

New cluster data directory already exysts.
Remove it manually and try again:

rm -rf ${this.#dataDir}

========================================
` );

            return result( 500 );
        }

        // install dependencies
        if ( !fs.existsSync( oldBinDir ) ) {
            res = childProcess.spawnSync( "apt", ["update"], { "stdio": "inherit" } );
            if ( res.status ) return result( 500 );

            res = childProcess.spawnSync(
                "apt",
                [

                    //
                    "install",
                    "postgresql-contrib",
                    `postgresql-${oldVersion}`,
                ],
                { "stdio": "inherit" }
            );
            if ( res.status ) return result( 500 );
        }

        // init new cluster
        res = await this.#initDb();
        if ( !res.ok ) return res;

        // XXX test, remove, if it is not possible to upgrade srandby
        // remove replication config, required if we upgrading standby
        fs.rmSync( oldDataDir + "/conf.d/20-replication.conf", { "force": true } );

        // check
        res = childProcess.spawnSync(
            `${this.#binDir}/pg_upgrade`,
            [

                //
                "--check",
                `--old-bindir=${oldBinDir}`,
                `--new-bindir=${this.#binDir}`,
                `--old-datadir=${oldDataDir}`,
                `--new-datadir=${this.#dataDir}`,
            ],
            {
                "cwd": this.#dataDir,
                "stdio": "inherit",
                "uid": this.#uid,
                "gid": this.#gid,
            }
        );
        if ( res.status ) return result( 500 );

        // upgrade
        res = childProcess.spawnSync(
            `${this.#binDir}/pg_upgrade`,
            [

                //
                `--old-bindir=${oldBinDir}`,
                `--new-bindir=${this.#binDir}`,
                `--old-datadir=${oldDataDir}`,
                `--new-datadir=${this.#dataDir}`,
                `--new-options=-c timescaledb.restoring=on''`,
            ],
            {
                "cwd": this.#dataDir,
                "stdio": "inherit",
                "uid": this.#uid,
                "gid": this.#gid,
            }
        );
        if ( res.status ) return result( 500 );

        // copy configs
        if ( fs.existsSync( oldDataDir + "/postgresql.auto.conf" ) ) {
            fs.copyFileSync( oldDataDir + "/postgresql.auto.conf", this.#dataDir + "/postgresql.auto.conf" );
        }

        console.log( `
========================================

Cluster upgraded to the version: ${this.#clusterVersion}.
Old cluster version ${oldVersion} can be removed.

Run manually, aftes server started:

vacuumdb --all --analyze-in-stages

========================================
` );

        return result( 200 );
    }

    async start () {
        var res = this.#init();
        if ( !res.ok ) return res;

        if ( this.#isStarted ) return result( 200 );
        this.#isStarted = true;

        // init primary
        if ( this.isPrimary ) {
            const res = await this.#initPrimary();
            if ( !res.ok ) return res;
        }

        // ini standby
        else {
            const res = await this.#initStandby();
            if ( !res.ok ) return res;
        }

        // start server
        this.#proc = childProcess.spawn( `${this.#binDir}/postgres`, ["-D", this.#dataDir, "-k", this.#unixSocketDirectories, "-h", "0.0.0.0"], {
            "uid": this.#uid,
            "gid": this.#gid,
            "stdio": "inherit",
            "detached": true,
        } );

        this.#proc.on( "exit", this.#onProcExit.bind( this ) );

        // init backup
        this.#startBackup();

        console.log( `PostgreSQL process started` );

        // wait for server is ready
        res = await this.#checkReady();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async stop () {
        return this.fastShutDown();
    }

    async shutDown () {
        return this.fastShutDown();
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

        fs.mkdirSync( this.#dataRoot, { "recursive": true } );
        fs.mkdirSync( this.#dataDir, { "recursive": true } );

        this.#uid = +childProcess.execFileSync( "id", ["-u", "postgres"], { "encoding": "utf8" } ).trim();
        this.#gid = +childProcess.execFileSync( "id", ["-g", "postgres"], { "encoding": "utf8" } ).trim();

        // chown
        const files = glob( "/**", {
            "cwd": this.#dataRoot,
            "directories": true,
        } );

        for ( const file of files ) {
            fs.chownSync( this.#dataRoot + "/" + file, this.#uid, this.#gid );
            fs.chmodSync( this.#dataRoot + "/" + file, 0o700 );
        }

        // create and prepare unix socket dir
        fs.mkdirSync( this.#unixSocketDirectories, { "recursive": true } );
        fs.chownSync( this.#unixSocketDirectories, this.#uid, this.#gid );

        return result( 200 );
    }

    async #initPrimary () {
        fs.rmSync( this.#dataDir + "/standby.signal", { "force": true } );

        // init db
        if ( !fs.existsSync( this.#dataDir + "/PG_VERSION" ) ) {
            const res = await this.#initDb();

            if ( !res.ok ) return res;
        }

        // write hba config
        this.#writeHbaConfig();

        // write postgres config
        this.#writePostgresConfig();

        this.#writeReplicationsConfig( true );

        // update extensions
        const res = await this.#updatePrimary();
        if ( !res.ok ) return res;

        this.#writeReplicationsConfig();

        return result( 200 );
    }

    async #initDb () {
        const pwfile = "/tmp/postgresql-password.txt";

        const superuserPassword = crypto.randomBytes( 16 ).toString( "base64url" );

        console.log( `GENERATED POSTGRES PASSWORD: ${superuserPassword}` );

        fs.rmSync( pwfile, { "force": true } );
        fs.writeFileSync( pwfile, superuserPassword );
        fs.chownSync( pwfile, this.#uid, this.#gid );

        var res = childProcess.spawnSync(
            `${this.#binDir}/initdb`,
            [

                //
                "--encoding=UTF8",
                "--no-locale",
                "-U",
                "postgres",
                `--pwfile=${pwfile}`,
                `--pgdata=${this.#dataDir}`,
            ],
            {
                "uid": this.#uid,
                "gid": this.#gid,
            }
        );

        if ( res.status ) {
            res = result( 500 );
        }
        else {
            res = result( 200 );
        }

        fs.rmSync( pwfile, { "force": true } );

        return res;
    }

    async #initStandby () {

        // base backup
        if ( !fs.existsSync( this.#dataDir + "/PG_VERSION" ) ) {
            const res = childProcess.spawnSync(
                `${this.#binDir}/pg_basebackup`,
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
                    "uid": this.#uid,
                    "gid": this.#gid,
                    "env": {
                        "PGPASSWORD": this.#config.replication.password,
                    },
                }
            );

            if ( res.status ) return result( 500 );
        }

        // write hba config
        this.#writeHbaConfig();

        // write postgres config
        this.#writePostgresConfig();

        fs.writeFileSync( this.#dataDir + "/standby.signal", "" );

        this.#writeReplicationsConfig();

        return result( 200 );
    }

    async #updatePrimary () {

        // run server
        const proc = childProcess.spawn( `${this.#binDir}/postgres`, ["-D", this.#dataDir, "-k", this.#unixSocketDirectories, "-h", "127.0.0.1"], {
            "uid": this.#uid,
            "gid": this.#gid,
            "stdio": "inherit",
            "detached": true,
        } );

        // wait for server is ready
        var res = await this.#checkReady();

        if ( res.ok ) {
            const dbh = await sql.new( "postgresql:?maxConnections=1" );

            res = await dbh.exec( sql`
-- replication role
DROP ROLE IF EXISTS`.ID( this.#config.replication.username ).sql`;
CREATE ROLE`.ID( this.#config.replication.username ).sql`WITH REPLICATION LOGIN;
ALTER ROLE`.ID( this.#config.replication.username ).sql`WITH PASSWORD ${this.#config.replication.password};
` );

            console.log( `Updating extensions ... ${res}` );
        }

        // shutdown server
        await new Promise( resolve => {
            proc.once( "exit", resolve );

            proc.kill( "SIGINT" );
        } );

        return res;
    }

    async #checkReady () {
        var timeout = setTimeout( () => ( timeout = null ), CHECK_READY_TIMEOUT );

        while ( true ) {
            const res = childProcess.spawnSync( `${this.#binDir}/pg_isready`, null, { "stdio": "inherit" } );

            if ( !res.status ) break;

            if ( !timeout ) break;

            await new Promise( resolve => setTimeout( resolve, 1000 ) );
        }

        if ( timeout ) {
            clearTimeout( timeout );

            return result( 200 );
        }
        else {
            return result( [500, `Server not started after timeout`] );
        }
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
            fs.copyFileSync( this.#dataDir + "/postgresql.conf", this.#baseConfigPath );
            fs.chownSync( this.#baseConfigPath, this.#uid, this.#gid );

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

        fs.writeFileSync( this.#userConfigPath, settings.join( "\n" ) );
        fs.chownSync( this.#userConfigPath, this.#uid, this.#gid );
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

        fs.writeFileSync( this.#replicationConfigPath, replicationConfig );
        fs.chownSync( this.#replicationConfigPath, this.#uid, this.#gid );

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

        this.#backupCron = new Cron( this.#config.backup.cron, { "runMissed": true } ).on( "tick", this.#backup.bind( this ) ).unref().start();
    }

    async #backup () {
        if ( !this.#backupMutex.tryLock() ) return;

        fs.mkdirSync( this.#backupDir, { "recursive": true } );
        fs.chownSync( this.#backupDir, this.#uid, this.#gid );
        fs.chmodSync( this.#backupDir, 0o700 );

        const backupId = new Date().toISOString();

        await new Promise( resolve => {
            childProcess
                .spawn(
                    `${this.#binDir}/pg_basebackup`,
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

        this.#shutdownSignal.broadcast();

        process.shutDown( { code } );
    }
}
