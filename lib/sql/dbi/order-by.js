const { Query } = require( "../dbi" );

const ORDER = {
    "asc": "ASC",
    "desc": "DESC",
};

module.exports = function ( ...values ) {
    return new OrderBy( values );
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
        for ( const value of this.values ) {
            if ( typeof value === "string" ) {
                values.push( this.quoteId( value ) );
            }
            else if ( Array.isArray( value ) ) {
                let order = "";

                if ( typeof value[0] === "string" ) {
                    order += this.quoteId( value[0] );
                }
                else {
                    throw Error( "Order value is invalid" );
                }

                if ( value[1] != null ) {
                    if ( typeof value[1] === "string" ) {
                        const dir = ORDER[value[1].toLowerCase()];

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
