import * as uuid from "#lib/uuid";

export default Super =>
    class extends ( Super || Object ) {
        #lockLevel = 0;

        // properties
        get _locks () {
            return this.#lockLevel;
        }

        set _locks ( value ) {
            this.#lockLevel = value;
        }

        // public
        begin ( mode, callback ) {
            const dbh = this._getDBH( true ),
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
            let res = dbh.do( savepointName ? `SAVEPOINT "${savepointName}"` : mode );

            // transaction started
            if ( res.ok ) {
                try {

                    // call transaction body
                    res = callback( dbh );

                    if ( res instanceof Promise ) throw Error( `SQLite transactions must be synchronous` );

                    res = result.try( res ?? result( 200 ) );

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

            dbh._locks--;

            if ( !dbh._locks ) dbh.emit( "release", dbh );

            return res;
        }

        lock ( callback ) {
            const dbh = this._getDBH( true );

            dbh._locks++;

            var res;

            // transaction started
            try {

                // call transaction body
                res = callback( dbh );

                if ( res instanceof Promise ) throw Error( `SQLite transactions must be synchronous` );

                res = result.try( res ?? result( 200 ) );
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
