import { sql } from "#lib/sql/query";

export default class {
    #pool;

    condtructor ( pool ) {
        this.#pool = pool;
    }

    // public
    // XXX
    async startCron () {
        const res = await this.#pool.select( sql`SELECT * FROM _schema_cron` );

        if ( !res.ok ) return res;
    }

    // XXX
    stopCron () {}
}
