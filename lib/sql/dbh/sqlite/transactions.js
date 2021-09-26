import * as uuid from "#lib/uuid";
import sql from "#lib/sql";

const QUERIES = {
    "begin": sql`BEGIN`.prepare(),
    "commit": sql`COMMIT`.prepare(),
    "rollback": sql`ROLLBACK`.prepare(),
    "beginSavepoint": sql`SAVEPOINT ?`.prepare(),
    "releaseSavepoint": sql`RELEASE SAVEPOINT ?`.prepare(),
    "rollbackSavepoint": sql`ROLLBACK TO SAVEPOINT ?`.prepare(),
};

export default Super =>
    class TransactionsAsync extends ( Super || Object ) {

        // public
        begin ( mode, callback ) {
            const dbh = this,
                savepointName = dbh.inTransaction ? uuid.v4() : null;

            let begin;

            if ( typeof mode === "function" ) {
                callback = mode;
                begin = QUERIES.begin;
            }
            else {
                begin = "BEGIN " + mode;
            }

            // start transaction
            let res = savepointName ? dbh.do( QUERIES.beginSavepoint, [savepointName] ) : dbh.do( begin );

            // transaction started
            if ( res.ok ) {
                try {

                    // call transaction body
                    res = callback( dbh );

                    if ( res instanceof Promise ) throw Error( `SQLite transactions must be synchronous` );

                    res = result.try( res );

                    // commit
                    const tres = savepointName ? dbh.do( QUERIES.releaseSavepoint, [savepointName] ) : dbh.do( QUERIES.commit );

                    // release failed
                    if ( !tres.ok ) res = tres;
                }
                catch ( e ) {
                    res = result.catch( e );

                    // rollback
                    savepointName ? dbh.do( QUERIES.rollbackSavepoint, [savepointName] ) : dbh.do( QUERIES.rollback );
                }
            }

            return res;
        }

        async lock ( callback ) {
            const dbh = this;

            var res;

            // transaction started
            try {

                // call transaction body
                res = result.try( await callback( dbh ) );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            return res;
        }
    };
