import Cron from "#lib/cron";
import Counter from "#lib/threads/counter";
import path from "node:path";
import Interval from "#lib/interval";
import Mutex from "#lib/threads/mutex";

export default class PostgreSqlBaclup {
    #postgresql;
    #cluster;
    #cron;
    #activityCounter = new Counter();
    #storageLocation;
    #intervals;
    #rotatingMutex = new Mutex();

    constructor ( postgresql, cluster ) {
        this.#postgresql = postgresql;
        this.#cluster = cluster;

        this.#storageLocation = path.posix.join( this.#postgresql.config.storageLocation, `backups-${ this.#cluster.version }-${ this.#cluster.name }` ) + "/";

        if ( this.#postgresql.config.backups ) {
            this.#intervals = [];

            for ( let interval of this.#postgresql.config.backups ) {
                interval = new Interval( interval, { "negative": true } );

                this.#intervals.push( interval );
            }

            this.#intervals = this.#intervals.sort( ( a, b ) => a.toMilliseconds() - b.toMilliseconds() );
        }
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

        // start cron
        this.#cron = new Cron( "0 * * * *" ).on( "tick", this.#rotateBackups.bind( this ) ).unref().start();

        this.#rotateBackups();
    }

    async stop () {
        if ( this.#cron ) {
            this.#cron.stop();

            this.#cron = null;
        }

        return this.#activityCounter.wait();
    }

    // private
    async #rotateBackups () {
        var res;

        if ( !this.#rotatingMutex.tryLock() ) return this.#rotatingMutex.wait();

        try {
            res = await this.app.storage.glob( "**", {
                "cwd": this.#storageLocation,
            } );

            const backups = [];

            if ( res.data ) {
                for ( const { path } of res.data ) {
                    const filename = path.substring( this.#storageLocation.length );

                    const meta = await this.app.storage.getFileMeta( filename, {
                        "cwd": this.#storageLocation,
                        "checkImage": true,
                    } );

                    if ( !meta ) {
                        if ( meta === false ) {
                            await this.app.storage.deleteFile( filename, {
                                "cwd": this.#storageLocation,
                            } );
                        }

                        continue;
                    }

                    backups.push( {
                        filename,
                        "date": meta.lastModified,
                        "keep": false,
                    } );
                }
            }

            const rotationDates = this.#intervals.map( interval => interval.toDate() );

            // make backup
            if ( !this.#fimdRotationDateBackup( rotationDates[ rotationDates.length - 1 ], backups ) ) {
                res = await this.#makeBackup();

                // failrf to create backup
                if ( !res.ok ) throw res;
            }

            // find outdated backuos
            for ( const rotationDate of rotationDates ) {
                const backup = this.#fimdRotationDateBackup( rotationDate, backups );

                if ( backup ) backup.keep = true;
            }

            // delete backups
            for ( const backup of backups ) {
                if ( backup.keep ) continue;

                res = await this.app.storage.deleteFile( backup.filename, {
                    "cwd": this.#storageLocation,
                } );

                console.log( "Backup delete:", backup.filename, res + "" );
            }

            res = result( 200 );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        this.#rotatingMutex.unlock( res );

        return res;
    }

    async #makeBackup () {
        var res;

        this.#activityCounter.value++;

        try {
            res = await this.#cluster.makeBackup();
            if ( !res.ok ) throw res;

            const file = res.data.file,
                lastModified = res.data.date,
                name = lastModified.toISOString().replaceAll( ":", "_" ) + ".tar";

            res = await this.app.storage.uploadFile( name, file, {
                "cwd": this.#storageLocation,
                lastModified,
            } );
            if ( !res.ok ) throw res;

            console.log( "Backup created:", name );
        }
        catch ( e ) {
            res = result.catch( e );

            console.log( "Backup failed:", res + "" );
        }

        this.#activityCounter.value--;

        return res;
    }

    #fimdRotationDateBackup ( rotationDate, backups ) {
        if ( !backups.length ) return;

        var foundBackup;

        for ( const backup of backups ) {
            if ( backup.date < rotationDate ) continue;

            if ( !foundBackup ) {
                foundBackup = backup;
            }
            else if ( backup.date < foundBackup.date ) {
                foundBackup = backup;
            }
        }

        return foundBackup;
    }
}
