import Cron from "#lib/cron";
import Counter from "#lib/threads/counter";
import path from "node:path";

export default class PostgreSqlBaclup {
    #postgresql;
    #cluster;
    #cron;
    #activityCounter = new Counter();
    #storageLocation;

    constructor ( postgresql, cluster ) {
        this.#postgresql = postgresql;
        this.#cluster = cluster;

        this.#storageLocation = path.posix.join( this.#postgresql.config.storageLocation + `${this.#cluster.version}-${this.#cluster.name}` ) + "/";
    }

    // properties
    get app () {
        return this.#postgresql.app;
    }

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

        const res = await this.app.storage.glob( this.#storageLocation + "**" );

        if ( res.data ) {
            for ( const { path } of res.data ) {
                const fileExists = await this.app.storage.fileExists( path, { "checkImage": true } );

                if ( !fileExists ) {
                    if ( fileExists === false ) {
                        await this.app.storage.deleteFile( path );
                    }

                    continue;
                }

                const file = path.substring( this.#storageLocation.length );

                if ( file.endsWith( ".hourly.tar" ) ) {
                    backups.hourly.push( file );
                }
                else if ( file.endsWith( ".daily.tar" ) ) {
                    backups.daily.push( file );
                }
                else if ( file.endsWith( ".weekly.tar" ) ) {
                    backups.weekly.push( file );
                }
                else if ( file.endsWith( ".monthly.tar" ) ) {
                    backups.monthly.push( file );
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

    async #makeBackup ( tags ) {
        this.#activityCounter.value++;

        const backups = await this.#getBackups();

        const res = await this.#cluster.makeBackup();

        console.log( res + "" );

        if ( res.ok ) {
            for ( const tag of tags ) {
                const backupsToDelete = [],
                    numberOfBackups = this.config.backups[tag];

                if ( backups[tag].length > numberOfBackups - 1 ) {
                    backupsToDelete.push( ...backups[tag].slice( 0, backups[tag].length - numberOfBackups + 1 ) );
                }

                // rotate nackups
                if ( backupsToDelete.length ) await this.#deleteBackups( backupsToDelete );

                await this.#uploadBackup( res.data.file, `${res.data.date}.${tag}.tar` );
            }

            res.data.file.destroy();
        }

        this.#activityCounter.value--;

        return res;
    }

    async #uploadBackup ( file, name ) {
        return this.app.storage.uploadFile( this.#storageLocation + name, file );
    }

    async #deleteBackups ( backups ) {
        if ( backups ) {
            for ( const file of backups ) {
                await this.app.storage.deleteFile( this.#storageLocation + file );
            }
        }
        else {
            await this.app.storage.deleteFile( this.#storageLocation + "**" );
        }
    }
}
