import fs from "node:fs";
import childProcess from "node:child_process";
import sql from "#lib/sql";
import env from "#lib/env";
import path from "node:path";
import glob from "#lib/glob";
import PostgreSqlCluster from "./postgresql/cluster.js";
import PostgreSqlBackup from "./postgresql/backup.js";

// NOTE https://www.postgresql.org/docs/current/server-shutdown.html

export default class PostgreSql {
    #app;
    #config;
    #dataRootDir;
    #unixSocketDir;
    #cluster;
    #replicationHostname;
    #backup;
    #uid;
    #gid;

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
    async upgrade ( oldClusterVersion, clusterName ) {
        var res;

        clusterName ||= this.config.clusterName;

        this.#cluster = new PostgreSqlCluster( this, process.env.POSTGRESQL_VERSION, clusterName );

        const oldCluster = new PostgreSqlCluster( this, oldClusterVersion, clusterName );

        // check old cluster data dir is exitsts
        if ( !oldCluster.isExists ) {
            return result( [ 500, `Old postgres cluster not found` ] );
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
                "apt",
                [

                    //
                    "install",
                    "postgresql-contrib",
                    `postgresql-${ oldCluster.version }`,
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
                `--new-options=-c timescaledb.restoring=on''`,
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
        if ( fs.existsSync( oldCluster.autoConfigPath ) ) {
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

    async init () {
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

        // ini standby
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

        this.#writeReplicationsConfig();

        // start server
        res = await this.#cluster.start( {
            "network": true,
            "standby": !this.isPrimary,
        } );
        if ( !res.ok ) return res;

        this.#cluster.on( "shutdown", this.#onClusterShutdown.bind( this ) );

        console.log( `PostgreSQL process started` );

        return result( 200 );
    }

    async start () {

        // init backup
        this.#backup = new PostgreSqlBackup( this, this.#cluster );
        await this.#backup.start();

        return result( 200 );
    }

    async stop () {
        await this.#backup?.stop();

        return this.#cluster.stop();
    }

    async shutDown () {
        await this.#backup?.stop();

        return this.#cluster.shutDown();
    }

    async shutDownSmart () {
        await this.#backup?.stop();

        if ( !this.#cluster.isStarted ) return;

        console.log( "PostgreSQL smart shutting down" );

        return this.#cluster.shutDownSmart();
    }

    async shutDownFast () {
        await this.#backup?.stop();

        if ( !this.#cluster.isStarted ) return;

        console.log( "PostgreSQL fast shutting down" );

        return this.#cluster.shutDownFast();
    }

    async shutDownImmediate () {
        await this.#backup?.stop();

        if ( !this.#cluster.isStarted ) return;

        console.log( "PostgreSQL immediate shutting down started" );

        return this.#cluster.shutDownImmediate();
    }

    // private
    #init () {
        if ( this.isSyncStandby ) {
            if ( !this.config.replication?.sync?.numberOfStandbys ) {
                return result( [ 400, `Sync standbys are not enabled` ] );
            }
        }
        else if ( this.isAsyncStandby && this.config.replication?.async?.replicateFrom === "sync" && !this.config.replication?.sync?.numberOfStandbys ) {
            return result( [ 400, `Can't replicate from sync standby` ] );
        }

        fs.mkdirSync( this.#dataRootDir, { "recursive": true } );
        fs.mkdirSync( this.#cluster.dataDir, { "recursive": true } );

        // chown
        const files = glob( "/**", {
            "cwd": this.#dataRootDir,
            "directories": true,
        } );

        for ( const file of files ) {
            fs.chownSync( this.#dataRootDir + "/" + file, this.uid, this.gid );
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

        // generate default settings
        const settings = [];

        const config = this.config.settings;

        for ( const name in config ) {
            const value = config[ name ];

            if ( value == null ) {
                continue;
            }
            else if ( typeof value === "string" ) {
                settings.push( `${ name } = '${ value }'` );
            }
            else {
                settings.push( `${ name } = ${ value }` );
            }
        }

        fs.writeFileSync( this.#cluster.userConfigPath, settings.join( "\n" ) );
        fs.chownSync( this.#cluster.userConfigPath, this.uid, this.gid );
    }

    #writeReplicationsConfig () {
        this.#cluster.deleteReplicationConfig();

        const replicationConfig = [];

        // primary
        if ( this.isPrimary ) {
            if ( this.config.replication?.sync?.numberOfStandbys ) {
                replicationConfig.push( `synchronous_standby_names = 'FIRST ${ this.config.replication.sync.numberOfStandbys } ( * )'` );
            }
        }

        // sync stanby
        else if ( this.isSyncStandby ) {
            replicationConfig.push( `primary_conninfo = 'host=${ this.replicationHostname } port=${ this.config.replication.port } user=${ this.config.replication.username } password=${ this.config.replication.password } application_name=${ this.#cluster.id }'`, `primary_slot_name = '${ this.#cluster.id }'` );
        }

        // async standby
        else {
            replicationConfig.push( `primary_conninfo = 'host=${ this.replicationHostname } port=${ this.config.replication.port } user=${ this.config.replication.username } password=${ this.config.replication.password }'`, `primary_slot_name = '${ this.#cluster.id }'` );
        }

        fs.writeFileSync( this.#cluster.replicationConfigPath, replicationConfig.join( "\n" ) );
        fs.chownSync( this.#cluster.replicationConfigPath, this.uid, this.gid );
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

        dbh.destroy();

        await this.#cluster.shutDown();

        return res;
    }

    #onClusterShutdown ( code, signal ) {
        console.log( `PostgreSQL process exited, code: ${ code }` );

        process.shutDown( { code } );
    }
}
