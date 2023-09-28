import Cron from "#lib/cron";
import fs from "node:fs";
import path from "node:path";
import Counter from "#lib/threads/counter";
import childProcess from "node:child_process";

export default class PostgreSqlBaclup {
    #postgresql;
    #cluster;
    #cron;
    #activityCounter = new Counter();

    constructor ( postgresql, cluster ) {
        this.#postgresql = postgresql;
        this.#cluster = cluster;
    }

    // properties
    get cluster () {
        return this.#cluster;
    }

    get config () {
        return this.#postgresql.config;
    }

    get isStarted () {
        return !!this.#cron;
    }

    // public
    async start () {
        if ( this.isStartrd ) return;

        if ( !this.#postgresql.isPrimary ) return;

        if ( !this.config.backups ) return;

        if ( !this.config.backups.hourly && !this.config.backups.daily && !this.config.backups.weekly && !this.config.backups.monthly ) {
            return;
        }

        const missedBackups = [],
            backupsToDelete = [],
            backups = await this.#getBackups();

        for ( const tag in backups ) {
            const numberOfBackups = this.config.backups[tag];

            if ( numberOfBackups ) {
                if ( !backups[tag].length ) {
                    missedBackups.push( tag );
                }
                else if ( backups[tag].length > numberOfBackups ) {
                    backupsToDelete.push( ...backups[tag].slice( 0, backups[tag].length - numberOfBackups ) );
                }
            }
            else {
                backupsToDelete.push( ...backups[tag] );
            }
        }

        if ( missedBackups.length ) await this.#makeBackup( missedBackups );

        if ( backupsToDelete.length ) await this.#deleteBackups( backupsToDelete );

        // start cron
        this.#cron = new Cron( "0 * * * *", {
            "runMissed": true,
        } )
            .on( "tick", this.#cronBackup.bind( this ) )
            .unref()
            .start();
    }

    async stop () {
        if ( this.#cron ) {
            this.#cron.stop();

            this.#cron = null;
        }

        return this.#activityCounter.wait();
    }

    // private
    async #getBackups () {
        const backups = {
            "hourly": [],
            "daily": [],
            "weekly": [],
            "monthly": [],
        };

        if ( fs.existsSync( this.#cluster.backupsDir ) ) {
            const files = fs.readdirSync( this.#cluster.backupsDir );

            for ( const file of files ) {
                if ( file.endsWith( ".hourly" ) ) {
                    backups.hourly.puah( file );
                }
                else if ( file.endsWith( ".daily" ) ) {
                    backups.daily.puah( file );
                }
                else if ( file.endsWith( ".weekly" ) ) {
                    backups.weekly.puah( file );
                }
                else if ( file.endsWith( ".monthly" ) ) {
                    backups.monthly.puah( file );
                }
            }

            for ( const tag in backups ) {
                backups[tag] = backups[tag].sort();
            }
        }

        return backups;
    }

    async #cronBackup () {
        const date = new Date(),
            tags = [];

        if ( this.config.backups.hourly ) {
            tags.push( "hourly" );
        }

        if ( date.getHours() === 0 ) {
            if ( this.config.backups.daily ) {
                tags.push( "daily" );
            }

            if ( date.getDay() === 0 && this.config.backups.weekly ) {
                tags.push( "weekly" );
            }

            if ( date.getDate() === 1 && this.config.backups.monthly ) {
                tags.push( "mnthly" );
            }
        }

        if ( !tags.length ) return;

        return this.#makeBackup( tags );
    }

    // XXX storage
    async #makeBackup ( tags ) {

        // XXX remove
        {
            const uid = +childProcess.execFileSync( "id", ["-u", "postgres"], { "encoding": "utf8" } ).trim(),
                gid = +childProcess.execFileSync( "id", ["-g", "postgres"], { "encoding": "utf8" } ).trim();

            fs.mkdirSync( this.#cluster.backupsDir, { "recursive": true } );
            fs.chownSync( this.#cluster.backupsDir, uid, gid );
            fs.chmodSync( this.#cluster.backupsDir, 0o700 );
        }

        this.#activityCounter.value++;

        const backups = await this.#getBackups();

        const res = await this.#cluster.makeBackup();

        console.log( res + "" );

        if ( !res.ok ) return res;

        const date = res.data.date;

        var baseBackupPath;

        for ( const tag of tags ) {
            const backupsToDelete = [],
                numberOfBackups = this.config.backups[tag];

            if ( backups[tag].length > numberOfBackups - 1 ) {
                backupsToDelete.push( ...backups[tag].slice( 0, backups[tag].length - numberOfBackups + 1 ) );
            }

            if ( backupsToDelete.length ) await this.#deleteBackups( backupsToDelete );

            const backupPath = path.join( this.#cluster.backupsDir, date + "." + tag + ".tar" );

            if ( !baseBackupPath ) {
                baseBackupPath = backupPath;

                fs.renameSync( res.data.file.path, backupPath );

                res.data.file.destroy();
            }
            else {
                fs.cpSync( baseBackupPath, backupPath, {
                    "recursive": true,
                    "force": true,
                } );
            }
        }

        this.#activityCounter.value--;

        return res;
    }

    async #deleteBackups ( backups ) {
        if ( backups ) {
            for ( const file of backups ) {
                fs.rmSync( this.#cluster.backupsDir + "/" + file, {
                    "force": true,
                    "recursive": true,
                } );
            }
        }
        else {
            fs.rmSync( this.#cluster.backupsDir, {
                "force": true,
                "recursive": true,
            } );
        }
    }
}
