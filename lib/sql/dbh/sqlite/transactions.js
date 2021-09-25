import * as uuid from "#lib/uuid";

export default Super =>
    class TransactionsAsync extends ( Super || Object ) {

        // public
        begin ( mode, callback ) {
            const dbh = this,
                savepointName = dbh.inTransaction ? uuid.v4() : null;

            if ( typeof mode === "function" ) {
                callback = mode;
                mode = "BEGIN";
            }
            else {
                mode = "BEGIN " + mode;
            }

            // start transaction
            let res = dbh.do( savepointName ? `SAVEPOINT "${savepointName}"` : mode );

            // transaction started
            if ( res.ok ) {
                try {

                    // call transaction body
                    res = callback( dbh );

                    if ( res instanceof Promise ) throw Error( `SQLite transactions must be synchronous` );

                    res = result.try( res );

                    // commit
                    const tres = dbh.do( savepointName ? `RELEASE SAVEPOINT "${savepointName}"` : "COMMIT" );

                    // release failed
                    if ( !tres.ok ) res = tres;
                }
                catch ( e ) {
                    res = result.catch( e );

                    // rollback
                    dbh.do( savepointName ? `ROLLBACK TO SAVEPOINT "${savepointName}"` : "ROLLBACK" );
                }
            }

            return res;
        }

        lock ( callback ) {
            const dbh = this;

            var res;

            // transaction started
            try {

                // call transaction body
                res = result.try( callback( dbh ) );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            return res;
        }
    };
