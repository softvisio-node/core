import Cron from "#lib/cron";
import Counter from "#lib/threads/counter";
import path from "node:path";
import Duration from "#lib/duration";

export default class PostgreSqlBaclup {
    #postgresql;
    #cluster;
    #cron;
    #activityCounter = new Counter();
    #storageLocation;
    #intervals;

    constructor ( postgresql, cluster ) {
        this.#postgresql = postgresql;
        this.#cluster = cluster;

        this.#storageLocation = path.posix.join( this.#postgresql.config.storageLocation, `backups-${this.#cluster.version}-${this.#cluster.name}` ) + "/";

        if ( this.#postgresql.config.backups ) {
            this.#intervals = [];

            for ( let interval of this.#postgresql.config.backups ) {
                interval = new Duration( interval, { "negative": true } );

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
        this.#cron = new Cron( "0 * * * *", {
            "runMissed": true,
        } )
            .on( "tick", this.#rotateBackups.bind( this ) )
            .unref()
            .start();

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
    // XXX
    async #rotateBackups () {
        const res = await this.app.storage.glob( "**", {
            "cwd": this.#storageLocation,
        } );

        if ( res.data ) {
            for ( const { path } of res.data ) {
                const file = path.substring( this.#storageLocation.length );

                const fileExists = await this.app.storage.fileExists( file, {
                    "cwd": this.#storageLocation,
                    "checkImage": true,
                } );

                if ( !fileExists ) {
                    if ( fileExists === false ) {
                        await this.app.storage.deleteFile( file, {
                            "cwd": this.#storageLocation,
                        } );
                    }

                    continue;
                }

                // XXX
                new Date( file.replace( ".tar", "" ).replaceAll( "_", ":" ) );
            }
        }

        // const checkPints = [];

        // for ( let duration of this.config.backups ) {
        //     duration = new Duration( duration );
        // }
    }

    async #makeBackup () {
        this.#activityCounter.value++;

        const res = await this.#cluster.makeBackup();

        if ( res.ok ) {
            const name = res.data.date.replaceAll( ":", "_" ) + ".tar";

            await this.app.storage.uploadFile( name, res.data.file, {
                "cwf": this.#storageLocation,
            } );
        }

        console.log( res + "" );

        this.#activityCounter.value--;

        return res;
    }
}
