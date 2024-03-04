import uuid from "#lib/uuid";
import sql from "#lib/sql";

const SQL = {
    "begin": sql`BEGIN`.prepare(),
    "commit": sql`COMMIT`.prepare(),
    "rollback": sql`ROLLBACK`.prepare(),
};

const locksCounter = Symbol();

export default Super =>
    class TransactionsAsync extends ( Super || class {} ) {
        #locks = 0;

        // properties
        get isLocked () {
            return !!this.#locks;
        }

        get [ locksCounter ] () {
            return this.#locks;
        }

        set [ locksCounter ] ( value ) {
            this.#locks = value;

            if ( !this.#locks ) this._checkIdle();
        }

        // public
        async begin ( mode, callback ) {
            const dbh = await this._getConnection( true ),
                savepointId = dbh.inTransaction ? uuid() : null;

            dbh[ locksCounter ]++;

            let begin;

            if ( typeof mode === "function" ) {
                callback = mode;
                begin = SQL.begin;
            }
            else {
                begin = "BEGIN " + mode;
            }

            // start transaction
            let res = await dbh.do( savepointId ? `SAVEPOINT "${ savepointId }"` : begin );

            var commited;

            // transaction started
            if ( res.ok ) {
                try {

                    // call transaction body
                    res = result.try( await callback( dbh ), { "allowUndefined": true } );

                    // commit
                    const commitRes = await dbh.do( savepointId ? `RELEASE SAVEPOINT "${ savepointId }"` : SQL.commit );

                    // release failed
                    if ( !commitRes.ok ) {
                        res = commitRes;
                    }

                    // top-level commit
                    else if ( !savepointId ) {
                        commited = true;
                    }
                }
                catch ( e ) {
                    res = result.catch( e );

                    // rollback
                    await dbh.do( savepointId ? `ROLLBACK TO SAVEPOINT "${ savepointId }"` : SQL.rollback );
                }
            }

            dbh[ locksCounter ]--;

            // finish transaction
            if ( !savepointId ) {
                if ( commited ) {
                    dbh.offAll( "rollback" );

                    await dbh.call( "commit" );
                }
                else {
                    dbh.offAll( "commit" );

                    await dbh.call( "rollback" );
                }
            }

            return res;
        }

        async lock ( callback ) {
            const dbh = await this._getConnection( true );

            dbh[ locksCounter ]++;

            var res;

            // transaction started
            try {

                // call transaction body
                res = result.try( await callback( dbh ), { "allowUndefined": true } );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            dbh[ locksCounter ]--;

            return res;
        }
    };
