const { mixin } = require( "../../mixins" );

module.exports = mixin( ( Super ) =>

/**
         * class: Session
         *
         */
    class extends Super {
            #dbh;

            constructor ( app, dbh ) {
                super( app, dbh );

                this.#dbh = dbh;
            }
    } );
