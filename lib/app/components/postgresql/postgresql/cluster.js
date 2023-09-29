import Events from "#lib/events";
import fs from "node:fs";
import path from "node:path";
import childProcess from "node:child_process";
import { TmpFile, TmpDir } from "#lib/tmp";
import crypto from "node:crypto";
import Mutex from "#lib/threads/mutex";
import Signal from "#lib/threads/signal";
import tar from "#lib/tar";

const CHECK_READY_TIMEOUT = 60_000,
    CHECK_READY_INTERVAL = 1000;

const uid = +childProcess.execFileSync( "id", ["-u", "postgres"], { "encoding": "utf8" } ).trim(),
    gid = +childProcess.execFileSync( "id", ["-g", "postgres"], { "encoding": "utf8" } ).trim();

export default class PostgreSqlCluster extends Events {
    #postgresql;
    #name;
    #version;
    #binDir;
    #dataDir;
    #postgresqlConfigPath;
    #autoConfigPath;
    #standbySignalPath;
    #baseConfigPath;
    #userConfigPath;
    #replicationConfigPath;
    #backupMutex = new Mutex();
    #proc;
    #onExitCallback;
    #shutdownSignal = new Signal();

    constructor ( postgresql, version, name ) {
        super();

        this.#postgresql = postgresql;
        this.#name = name;
        this.#version = +version;

        this.#binDir = `/usr/lib/postgresql/${this.#version}/bin`;
        this.#dataDir = path.join( this.#postgresql.dataRootDir, this.#version + "", this.#name );

        this.#postgresqlConfigPath = this.#dataDir + "/postgresql.conf";
        this.#autoConfigPath = this.#dataDir + "/postgresql.auto.conf";
        this.#standbySignalPath = this.#dataDir + "/standby.signal";
        this.#baseConfigPath = this.#dataDir + "/conf.d/0-postgresql.conf";
        this.#userConfigPath = this.#dataDir + "/conf.d/10-user.conf";
        this.#replicationConfigPath = this.#dataDir + "/conf.d/20-replication.conf";
    }

    // properties
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

    // public
    async start ( { standby, netwoek = true } = {} ) {

        // already started
        if ( this.#proc ) return result( 500 );

        const listen = netwoek ? "0.0.0.0" : "127.0.0.1";

        if ( standby ) {
            fs.writeFileSync( this.#standbySignalPath, "" );
        }
        else {
            this.deleteStandbysignl();
        }

        // create and prepare unix socket dir
        fs.mkdirSync( this.#postgresql.unixSocketDir, { "recursive": true } );
        fs.chownSync( this.#postgresql.unixSocketDir, uid, gid );

        this.#proc = childProcess.spawn(
            `${this.#binDir}/postgres`,
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
                uid,
                gid,
                "stdio": "inherit",
                "detached": true,
            }
        );

        this.#onExitCallback ??= () => this.#proc?.kill( "SIGINT" );
        process.once( "exit", this.#onExitCallback );

        this.#proc.on( "exit", this.#onServerExit.bind( this ) );

        const res = await this.#checkReady();

        if ( !res.ok ) await this.shutDownFast();

        return res;
    }

    async stop () {
        return this.shutDownFast();
    }

    async shutDown () {
        return this.shutDownFast();
    }

    async shutDownSmart () {
        if ( !this.#proc ) return;

        this.#proc.kill( "SIGTERM" );

        return this.#shutdownSignal.wait();
    }

    async shutDownFast () {
        if ( !this.#proc ) return;

        this.#proc.kill( "SIGINT" );

        return this.#shutdownSignal.wait();
    }

    async shutDownImmediate () {
        if ( !this.#proc ) return;

        this.#proc.kill( "SIGQUIT" );

        return this.#shutdownSignal.wait();
    }

    async initDb () {
        if ( this.isExists ) return result( [500, `Cluster already exists`] );

        const password = crypto.randomBytes( 16 ).toString( "base64url" );

        const passwordFile = new TmpFile();
        fs.writeFileSync( passwordFile.path, password );
        fs.chownSync( passwordFile.path, uid, gid );

        var res = childProcess.spawnSync(
            `${this.binDir}/initdb`,
            [

                //
                "--encoding=UTF8",
                "--no-locale",
                "-U",
                "postgres",
                `--pwfile=${passwordFile}`,
                `--pgdata=${this.dataDir}`,
            ],
            {
                uid,
                gid,
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
        console.log( "===========================", [

            //
            "--host=" + this.#postgresql.replicationHostname,
            "--pgdata=" + this.#dataDir,
            "--username=" + this.#postgresql.config.replication.username,
            "--no-password",
            "--wal-method=stream",

            "--create-slot",
            "--slot=" + this.#postgresql.app.env.instanceId,

            // "--progress",
            // "--verbose",
            // "--write-recovery-conf",
        ] );

        const res = childProcess.spawnSync(
            `${this.#binDir}/pg_basebackup`,
            [

                //
                "--host=" + this.#postgresql.replicationHostname,
                "--pgdata=" + this.#dataDir,
                "--username=" + this.#postgresql.config.replication.username,
                "--no-password",
                "--wal-method=stream",

                "--create-slot",
                "--slot=" + this.#postgresql.app.env.instanceId,

                // "--progress",
                // "--verbose",
                // "--write-recovery-conf",
            ],
            {
                uid,
                gid,
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

        fs.chownSync( tmpDir.path, uid, gid );
        fs.chmodSync( tmpDir.path, 0o700 );

        const backupDate = new Date().toISOString();

        var res = await new Promise( resolve => {
            childProcess
                .spawn(
                    `${this.binDir}/pg_basebackup`,
                    [

                        //
                        "--label=" + backupDate,
                        "--pgdata=" + tmpDir.path,
                        "--format=tar",
                        "--gzip",
                        "--username=" + this.#postgresql.config.replication.username,
                        "--wal-method=stream",
                    ],
                    {
                        uid,
                        gid,
                    }
                )
                .on( "exit", code => {
                    var res;

                    if ( code ) {
                        res = result( [500, `Backup error, code: ${code}`] );
                    }
                    else {
                        res = result( 200 );
                    }

                    resolve( res );
                } );
        } );

        if ( res.ok ) {
            const tmpFile = new TmpFile();

            tar.create( {
                "cwd": tmpDir.path,
                "gzip": false,
                "portable": true,
                "sync": true,
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

    deleteStandbysignl () {
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

    // private
    async #checkReady () {
        var timeout = setTimeout( () => ( timeout = null ), CHECK_READY_TIMEOUT );

        while ( true ) {
            const res = childProcess.spawnSync( `${this.binDir}/pg_isready`, null, { "stdio": "inherit" } );

            if ( !res.status ) break;

            if ( !timeout ) break;

            await new Promise( resolve => setTimeout( resolve, CHECK_READY_INTERVAL ) );
        }

        if ( timeout ) {
            clearTimeout( timeout );

            return result( 200 );
        }
        else {
            return result( [500, `Server not started after timeout`] );
        }
    }

    #onServerExit ( code, signal ) {
        this.#proc = null;

        process.off( "exit", this.#onExitCallback );

        this.emit( "shutdown", code, signal );

        this.#shutdownSignal.broadcast();
    }
}
