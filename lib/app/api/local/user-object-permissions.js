const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );

module.exports = mixin( ( Super ) =>
    class extends Super {
            #dbh;

            constructor ( app, dbh ) {
                super( app, dbh );

                this.#dbh = dbh;
            }

            createUserActionToken () {}

            verifyUserActionToken () {}

            removeUserActionToken () {}
    } );
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 2:7           | no-unused-vars               | 'result' is assigned a value but never used.                                   |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 3:7           | no-unused-vars               | 'sql' is assigned a value but never used.                                      |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
