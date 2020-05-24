const { Query } = require( "../dbi" );

module.exports = function ( ...values ) {
    return new In( Array.isArray( values[0] ) ? values[0] : values );
};

class In extends Query {
    values;

    constructor ( values ) {
        super();

        this.values = values;
    }

    buildQuery ( n ) {
        var values = [],
            params = [];

        for ( const val of this.values ) {
            if ( val === undefined ) {
                continue;
            }
            else {
                values.push( "$" + ++n );

                params.push( val );
            }
        }

        if ( values.length ) {
            return ["IN ( " + values.join( ", " ) + " )", params];
        }
        else {
            return null;
        }
    }
}
