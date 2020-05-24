const { Query } = require( "../dbi" );

module.exports = function ( ...values ) {
    return new GroupBy( values );
};

class GroupBy extends Query {
    values;

    constructor ( values ) {
        super();

        this.values = values;
    }

    buildQuery ( n ) {
        var values = [];

        for ( const value of this.values ) {
            if ( value == null ) {
                continue;
            }
            else if ( Array.isArray( value ) ) {
                for ( const val of value ) {
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
            }
            else if ( typeof value === "string" ) {
                values.push( this.quoteId( value ) );
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
