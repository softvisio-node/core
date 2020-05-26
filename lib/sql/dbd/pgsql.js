const { Dbh } = require( "../dbd" );

module.exports = class extends Dbh {
    isPgsql = true;

    constructor ( url ) {
        super( url );
    }

    quote ( value, type ) {
        return value;
    }
};
