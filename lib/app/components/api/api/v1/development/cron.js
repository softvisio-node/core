import sql from "#lib/sql";

const SQL = {
    "getSchedule": sql`SELECT id, module, name, cron, timezone, query, run_missed, next_start, last_started, last_finished, error FROM _schema_cron'`.prepare(),
};

export default Super =>
    class extends Super {
        async API_getSchedule ( ctx ) {
            return this.dbh.select( SQL.getSchedule );
        }
    };
