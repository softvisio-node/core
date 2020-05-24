const { Query } = require( "../dbi" );

module.exports = function ( ...values ) {
    return new GroupBy( Array.isArray( values[0] ) ? values[0] : values );
};

class GroupBy extends Query {
    values;

    constructor ( values ) {
        super();

        this.values = values;
    }

    buildQuery ( n ) {
        var values = [];

        for ( const val of this.values ) {
            if ( val == null ) {
                continue;
            }
            else if ( typeof val === "string" ) {
                values.push( this.quoteId( val ) );
            }
            else {
                throw Error( "GROUP_BY value is invalid" );
            }
        }

        if ( values.length ) {
            return ["GROUP BY " + values.join( ", " ), []];
        }
        else {
            return null;
        }
    }
}
