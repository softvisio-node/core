import * as uuid from "#lib/uuid";
import sql from "#lib/sql";

const QUERIES = {
    "begin": sql`BEGIN`.prepare(),
    "commit": sql`COMMIT`.prepare(),
    "rollback": sql`ROLLBACK`.prepare(),
};

export default Super =>
    class TransactionsAsync extends ( Super || Object ) {
        #locks = 0;

        // properties
        get _locks () {
            return this.#locks;
        }

        set _locks ( value ) {
            this.#locks = value;
        }

        // public
        async begin ( mode, callback ) {
            const dbh = await this._getDbh( true ),
                savepointName = dbh.inTransaction ? uuid.v4() : null;

            dbh._locks++;

            let begin;

            if ( typeof mode === "function" ) {
                callback = mode;
                begin = QUERIES.begin;
            }
            else {
                begin = "BEGIN " + mode;
            }

            // start transaction
            let res = await dbh.do( savepointName ? `SAVEPOINT "${savepointName}"` : begin );

            // transaction started
            if ( res.ok ) {
                try {

                    // call transaction body
                    res = result.try( await callback( dbh ) );

                    // commit
                    const tres = await dbh.do( savepointName ? `RELEASE SAVEPOINT "${savepointName}"` : QUERIES.commit );

                    // release failed
                    if ( !tres.ok ) res = tres;
                }
                catch ( e ) {
                    res = result.catch( e );

                    // rollback
                    await dbh.do( savepointName ? `ROLLBACK TO SAVEPOINT "${savepointName}"` : QUERIES.rollback );
                }
            }

            dbh._locks--;

            if ( !dbh._locks ) dbh.emit( "release", dbh );

            return res;
        }

        async lock ( callback ) {
            const dbh = await this._getDbh( true );

            dbh._locks++;

            var res;

            // transaction started
            try {

                // call transaction body
                res = result.try( await callback( dbh ) );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            dbh._locks--;

            // release dbh
            if ( !dbh._locks ) dbh.emit( "release", dbh );

            return res;
        }
    };
