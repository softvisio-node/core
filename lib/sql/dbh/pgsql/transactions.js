import * as uuid from "#lib/uuid";

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

            if ( typeof mode === "function" ) {
                callback = mode;
                mode = "BEGIN";
            }
            else {
                mode = "BEGIN " + mode;
            }

            // start transaction
            let res = await dbh.do( savepointName ? `SAVEPOINT "${savepointName}"` : mode );

            // transaction started
            if ( res.ok ) {
                try {

                    // call transaction body
                    res = result.try( await callback( dbh ) );

                    // commit
                    const tres = await dbh.do( savepointName ? `RELEASE SAVEPOINT "${savepointName}"` : "COMMIT" );

                    // release failed
                    if ( !tres.ok ) res = tres;
                }
                catch ( e ) {
                    res = result.catch( e );

                    // rollback
                    await dbh.do( savepointName ? `ROLLBACK TO SAVEPOINT "${savepointName}"` : "ROLLBACK" );
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
