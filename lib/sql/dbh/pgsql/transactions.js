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
            const dbh = await this._getDBH( true ),
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
            let res = savepointName ? await dbh.do( QUERIES.beginSavepoint, [savepointName] ) : await dbh.do( begin );

            // transaction started
            if ( res.ok ) {
                try {

                    // call transaction body
                    res = result.try( await callback( dbh ) );

                    // commit
                    const tres = savepointName ? await dbh.do( QUERIES.releaseSavepoint, [savepointName] ) : await dbh.do( QUERIES.commit );

                    // release failed
                    if ( !tres.ok ) res = tres;
                }
                catch ( e ) {
                    res = result.catch( e );

                    // rollback
                    savepointName ? await dbh.do( QUERIES.rollbackSavepoint, [savepointName] ) : await dbh.do( QUERIES.rollback );
                }
            }

            dbh._locks--;

            if ( !dbh._locks ) dbh.emit( "release", dbh );

            return res;
        }

        async lock ( callback ) {
            const dbh = await this._getDBH( true );

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
