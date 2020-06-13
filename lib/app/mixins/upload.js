const { mixin } = require( "../../mixins" );
const result = require( "../../result" );

module.exports = mixin( ( Super ) =>

/** class: Upload
         *
         */
    class extends Super {
            uploadIdleTimeout = 1000 * 60;
            uploadChunkSize = 1024 * 1024; // 1Mb
            uploadMaxSize = 1024 * 50; // 50Mb
            uploadFilenameIsRequired = true;

            readDefaultLimit;
            readDefaultOrderBy;

            #api;
            #dbh;

            constructor ( app, api, options ) {
                super( app, api, options );

                this.#api = api;
                this.#dbh = options.dbh;
            }
    } );
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 2:7           | no-unused-vars               | 'result' is assigned a value but never used.                                   |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
