const { Dbh } = require( "../dbh" );

module.exports = class extends Dbh {
    isSQLite = true;

    constructor ( url ) {
        super( url );
    }

    quote ( value, type ) {
        return value;
    }
};
