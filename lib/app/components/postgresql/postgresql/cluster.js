import fs from "node:fs";
import path from "node:path";
import childProcess from "node:child_process";
import { TmpFile } from "#;ib/tmp";
import crypto from "node:crypto";
import Mutex from "#lib/threads/mutex";

const uid = +childProcess.execFileSync( "id", ["-u", "postgres"], { "encoding": "utf8" } ).trim(),
    gid = +childProcess.execFileSync( "id", ["-g", "postgres"], { "encoding": "utf8" } ).trim();

export default class PostgreSqlCluster {
    #name;
    #version;
    #binDir;
    #dataDir;
    #backupsDir;
    #baseConfigPath;
    #userConfigPath;
    #replicationConfigPath;
    #backupMutex = new Mutex();

    constructor ( dataRoot, version, name ) {
        this.#name = name;
        this.#version = +version;

        this.#binDir = `/usr/lib/postgresql/${this.#version}/bin`;
        this.#dataDir = path.join( dataRoot, this.#version + "", this.#name );
        this.#backupsDir = path.join( dataRoot, this.#version + "", this.#name + ".backups" );

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

    get binDir () {
        return this.#binDir;
    }

    get dataDir () {
        return this.#dataDir;
    }

    get backupsDir () {
        return this.#backupsDir;
    }

    get isExists () {
        return fs.existsSync( this.dataDir + "/PG_VERSION" );
    }

    get binIsExists () {
        return fs.existsSync( this.#binDir );
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

    async makeBackup ( replicationUsername ) {
        if ( !this.#backupMutex.tryLock() ) return;

        fs.mkdirSync( this.backupsDir, { "recursive": true } );
        fs.chownSync( this.backupsDir, uid, gid );
        fs.chmodSync( this.backupsDir, 0o700 );

        const backupId = new Date().toISOString();

        const res = await new Promise( resolve => {
            childProcess
                .spawn(
                    `${this.binDir}/pg_basebackup`,
                    [

                        //
                        "--label=" + backupId,
                        "--pgdata=" + path.join( this.backupsDir, backupId ),
                        "--format=tar",
                        "--gzip",
                        "--username=" + replicationUsername,

                        // "--progress",
                        // "--verbose",
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
                        res = result( [200, `Backup created: ${backupId}`, { backupId }] );
                    }

                    resolve( res );
                } );
        } );

        this.#backupMutex.unlock();

        return res;
    }
}
