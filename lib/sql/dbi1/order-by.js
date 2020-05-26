const { Query } = require( "../dbi" );

const ORDER = {
    "asc": "ASC",
    "desc": "DESC",
};

module.exports = function ( ...values ) {
    return new OrderBy( Array.isArray( values[0] ) && Array.isArray( values[0][0] ) ? values[0] : values );
};

class OrderBy extends Query {
    values;

    constructor ( values ) {
        super();

        this.values = values;
    }

    buildQuery ( n ) {
        var values = [];

        // [ name, [name, order], ... ]
        for ( const val of this.values ) {
            if ( val == null ) {
                continue;
            }
            else if ( typeof val === "string" ) {
                values.push( this.quoteId( val ) );
            }
            else if ( Array.isArray( val ) ) {
                let order = "";

                if ( typeof val[0] === "string" ) {
                    order += this.quoteId( val[0] );
                }
                else {
                    throw Error( "Order value is invalid" );
                }

                if ( val[1] != null ) {
                    if ( typeof val[1] === "string" ) {
                        const dir = ORDER[val[1].toLowerCase()];

                        if ( !dir ) {
                            throw Error( "Order value is invalid" );
                        }
                        else {
                            order += " " + dir;
                        }
                    }
                    else {
                        throw Error( "Order value is invalid" );
                    }
                }

                values.push( order );
            }
            else {
                throw Error( "Order value is invalid" );
            }
        }

        if ( values.length ) {
            return ["ORDER BY " + values.join( ", " ), []];
        }
        else {
            return null;
        }
    }
}
