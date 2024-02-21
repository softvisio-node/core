import uuid from "#lib/uuid";
import sql from "#lib/sql";

const SQL = {
    "begin": sql`BEGIN`.prepare(),
    "commit": sql`COMMIT`.prepare(),
    "rollback": sql`ROLLBACK`.prepare(),
};

export default Super =>
    class TransactionsSync extends ( Super || class {} ) {

        // public
        begin ( mode, callback ) {
            const dbh = this,
                savepointName = dbh.inTransaction ? uuid() : null;

            let begin;

            if ( typeof mode === "function" ) {
                callback = mode;
                begin = SQL.begin;
            }
            else {
                begin = "BEGIN " + mode;
            }

            // start transaction
            let res = dbh.do( savepointName ? `SAVEPOINT "${ savepointName }"` : begin );

            // transaction started
            if ( res.ok ) {
                try {

                    // call transaction body
                    res = callback( dbh );

                    if ( res instanceof Promise ) throw Error( `SQLite transactions must be synchronous` );

                    res = result.try( res, { "allowUndefined": true } );

                    // commit
                    const tres = dbh.do( savepointName ? `RELEASE SAVEPOINT "${ savepointName }"` : SQL.commit );

                    // release failed
                    if ( !tres.ok ) res = tres;
                }
                catch ( e ) {
                    res = result.catch( e );

                    // rollback
                    dbh.do( savepointName ? `ROLLBACK TO SAVEPOINT "${ savepointName }"` : SQL.rollback );
                }
            }

            return res;
        }
    };
