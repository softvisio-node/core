import sqlConst from "#lib/sql/const";
import Cron from "#lib/cron";

export default Super =>
    class extends ( Super || Object ) {
        #tasks = {};

        async runCron () {
            if ( !this.hasSchema ) return;

            const cron = await this.select( `SELECT * FROM "${sqlConst.cronTableName}"` );
            if ( !cron.ok ) return cron;

            if ( !cron.data ) return result( 200 );

            for ( const task of cron.data ) {
                this.#tasks[task.id] = new Cron( task.cron, { "timezone": task.timezone } )
                    .on( "tick", async cron => {
                        const dbh = this._newDbh();

                        await dbh.selectRow( `SELECT _run_cron_task( ?, ? )`, [task.id, cron.nextDate] );

                        dbh.destroy();
                    } )
                    .unref()
                    .start();
            }

            return result( 200 );
        }
    };
