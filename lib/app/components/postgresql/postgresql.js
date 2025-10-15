import fs from "node:fs";
import path from "node:path";
import env from "#lib/env";
import PostgreSqlCluster from "./postgresql/cluster.js";
import utils from "./postgresql/utils.js";

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

    get isPrimary () {
        return this.config.mode === "primary";
    }

    get isSyncStandby () {
        return this.config.mode === "standby-sync";
    }

    get isAsyncStandby () {
        return this.config.mode === "standby-async";
    }

    get isBackup () {
        return this.config.mode === "backup";
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
            else if ( this.isBackup ) {
                this.#replicationHostname = this.config.replication.primary.hostname;
            }
        }

        return this.#replicationHostname;
    }

    // public
    // XXX
    async init () {

        // check config
        if ( this.isSyncStandby ) {
            if ( !this.config.replication?.sync?.numberOfStandbys ) {
                return result( [ 400, "Sync standbys are not enabled" ] );
            }
        }
        else if ( this.isAsyncStandby && this.config.replication?.async?.replicateFrom === "sync" && !this.config.replication?.sync?.numberOfStandbys ) {
            return result( [ 400, "Can't replicate from sync standby" ] );
        }

        // init data dir
        await fs.promises.mkdir( this.dataDir, { "recursive": true } );

        // init unix socket dir
        await fs.promises.mkdir( this.unixSocketDir, { "recursive": true } );
        await utils.chmodDir( this.unixSocketDir );

        this.#cluster = new PostgreSqlCluster( this, process.env.POSTGRESQL_VERSION, this.config.clusterName );

        var res;

        // start backup
        if ( this.isBackup ) {
            res = await this.#cluster.startBackup();
            if ( !res.ok ) return res;
        }

        // start primary
        else if ( this.isPrimary ) {
            res = await this.#cluster.startPrimary();
            if ( !res.ok ) return res;
        }

        // start standby
        else {
            res = await this.#cluster.startStandby();
            if ( !res.ok ) return res;
        }

        this.#cluster.on( "stop", this.#onClusterStop.bind( this ) );

        console.log( "PostgreSQL process started" );

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
    #onClusterStop ( code, signal ) {
        console.log( `PostgreSQL process exited, code: ${ code }` );

        process.destroy( { code } );
    }
}
