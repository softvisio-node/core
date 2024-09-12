import Decimal from "#lib/decimal";

const BOOLEAN_TRUE_VALUES = new Set( [ "t", "true" ] );

export function encodeBuffer ( value ) {
    return "\\x" + value.toString( "hex" );
}

export function decodeBuffer ( value ) {
    if ( Buffer.isBuffer( value ) ) {
        return Buffer.from( value.toString( "latin1", 2 ), "hex" );
    }
    else {
        return Buffer.from( value.slice( 2 ), "hex" );
    }
}

export function encodeDate ( value ) {
    return value.toISOString();
}

export function encodeArray ( data, { readable } = {} ) {
    if ( data == null ) return "NULL";

    if ( !Array.isArray( data ) ) throw TypeError( `Unable to encode PostgreSQL array` );

    const space = readable
            ? " "
            : "",
        array = [];

    for ( let value of data ) {
        if ( value == null ) {
            value = "NULL";
        }
        else if ( typeof value === "string" ) {
            value = '"' + value.replaceAll( "\\", "\\\\" ).replaceAll( '"', '\\"' ) + '"';
        }
        else if ( typeof value === "boolean" ) {
            value = value
                ? "TRUE"
                : "FALSE";
        }
        else if ( typeof value === "object" ) {
            if ( Array.isArray( value ) ) {
                value = encodeArray( value, { readable } );
            }
            else if ( Buffer.isBuffer( value ) ) {
                value = encodeBuffer( value ).replaceAll( "\\", "\\\\" );
            }
            else if ( value instanceof Date ) {
                value = encodeDate( value );
            }
            else {
                value = '"' + JSON.stringify( value ).replaceAll( "\\", "\\\\" ).replaceAll( '"', '\\"' ) + '"';
            }
        }
        else if ( typeof value !== "number" ) {
            throw TypeError( `PostgreSQL array item type is not valid` );
        }

        array.push( value );
    }

    if ( !array.length ) {
        return "{}";
    }
    else {
        return `{${ space }${ array.join( "," + space ) }${ space }}`;
    }
}

export function decodeArray ( data, valueDecoder = String ) {
    if ( Buffer.isBuffer( data ) ) {
        data = data.toString();
    }

    if ( !data.startsWith( "{" ) ) throw TypeError( `Not a PostgreSQL array` );

    const arrays = [];

    var array,
        valueStart = null,
        valueEnd = null,
        escapeStarted = false,
        quoteStarted = false,
        valueQuoted = false;

    for ( let n = 0; n < data.length; n++ ) {
        if ( valueStart == null ) {

            // start array
            if ( data[ n ] === "{" ) {
                const subArray = [];

                if ( array ) {
                    array.push( subArray );

                    arrays.push( array );
                }

                array = subArray;
            }

            // end array
            else if ( data[ n ] === "}" ) {
                if ( arrays.length ) {
                    array = arrays.pop();
                }
            }

            // values separator
            else if ( data[ n ] === "," ) {
                continue;
            }

            // ignore spaces
            else if ( data[ n ] === " " ) {
                continue;
            }

            // start value
            else {

                // value is quoted
                if ( data[ n ] === '"' ) {
                    valueStart = n + 1;
                    quoteStarted = true;
                    valueQuoted = true;
                }
                else {
                    valueStart = n;
                }
            }
        }

        // value
        else {

            // escape
            if ( data[ n ] === "\\" ) {
                escapeStarted = !escapeStarted;

                continue;
            }

            // skip escaped character
            if ( escapeStarted ) {
                escapeStarted = false;

                continue;
            }

            // quote
            if ( quoteStarted ) {

                // end quote
                if ( data[ n ] === '"' ) {
                    quoteStarted = false;
                    valueEnd = n;
                }

                continue;
            }

            // end value
            if ( data[ n ] === "}" || data[ n ] === "," ) {
                let value;

                // value is quoted
                if ( valueQuoted ) {
                    value = data.slice( valueStart, valueEnd );
                }

                // value is not quoted
                else {
                    value = data.slice( valueStart, n );

                    // remove trailing spaces
                    if ( value.endsWith( " " ) ) {
                        value = value.replace( / +$/, "" );
                    }

                    // NULL value
                    if ( value.toLowerCase() === "null" ) {
                        value = null;
                    }
                }

                valueQuoted = false;
                valueStart = null;
                valueEnd = null;

                // decode not null value
                if ( value != null ) {

                    // unescape value
                    value = value.replaceAll( /\\(.)/g, ( match, char ) => char );

                    value = valueDecoder( value );
                }

                array.push( value );

                // end array
                if ( data[ n ] === "}" && arrays.length ) {
                    array = arrays.pop();
                }
            }
        }
    }

    return array;
}

export function decodeBoolean ( value ) {
    return BOOLEAN_TRUE_VALUES.has( value.toLowerCase() );
}

export function decodeNumber ( value, fractionalPrecision ) {
    if ( typeof value !== "number" ) {
        if ( Buffer.isBuffer( value ) ) {
            value = Number( value.toString( "latin1" ) );
        }
        else {
            value = Number( value );
        }
    }

    if ( fractionalPrecision == null ) {
        return value;
    }
    else {
        return Number( value.toFixed( fractionalPrecision ) );
    }
}

export function decodeSafeInteger ( value ) {
    if ( typeof value !== "number" ) {
        if ( Buffer.isBuffer( value ) ) {
            value = Number( value.toString( "latin1" ) );
        }
        else {
            value = Number( value );
        }
    }

    CHECK_RANGE: if ( !Number.isSafeInteger( value ) ) {
        if ( !Number.isInteger( value ) ) {
            value = Number.parseInt( value );

            if ( Number.isSafeInteger( value ) ) break CHECK_RANGE;
        }

        throw RangeError( "Number is out of range" );
    }

    return value;
}

export function decodeBigInt ( value ) {
    if ( typeof value === "bigint" ) {
        return value;
    }
    else if ( Buffer.isBuffer( value ) ) {
        return BigInt( value.toString( "latin1" ) );
    }
    else {
        return BigInt( value );
    }
}

const DEFAULT_TYPES = [

    // float
    {
        "names": {
            "float4": 700, // real
            "float8": 701, // double
        },

        "decode": Number,
    },

    // integer
    {
        "names": {
            "int2": 21, // smallint
            "int4": 23, // integer
            "oid": 26,
        },

        "decode": Number,
    },

    // numeric
    {
        "names": {
            "numeric": 1700,
        },
    },

    // decimal
    {
        "names": {
            "decimal": null,
        },

        "decode": Decimal,
    },

    // int8
    {
        "names": {
            "int8": 20, // bigint
            "int53": null,
            "integer": null, // SQLite specific number
        },

        "decode": decodeSafeInteger,
    },

    // boolean
    {
        "names": {
            "bool": 16, // boolean
        },

        "decodePostgresql": value => value[ 0 ] === 0x74, // "t", "f"

        "decodeSqlite": Boolean,
    },

    // json
    {
        "names": {
            "json": 114,
            "jsonb": 3802,
        },

        "decode": JSON.parse,
    },

    // buffer
    {
        "names": {
            "bytea": 17,
        },

        "decodePostgresql": decodeBuffer,
    },

    // bigint
    {
        "names": {
            "bigint": null,
        },

        "decode": decodeBigInt,
    },

    // arrays
    {
        "names": {
            "text-array": 1009,
            "money-array": 791,
        },

        "decode": value => decodeArray( value, String ),
    },
    {
        "names": {
            "float4-array": 1021,
            "float8-array": 1022,
        },

        "decode": value => decodeArray( value, Number ),
    },
    {
        "names": {
            "int2-array": 1005,
            "int4-array": 1007,
        },

        "decode": value => decodeArray( value, Number ),
    },
    {
        "names": {
            "int8-array": 1016,
            "int53-array": null,
        },

        "decode": value => decodeArray( value, decodeSafeInteger ),
    },
    {
        "names": {
            "bool-array": 1000,
        },

        "decode": value => decodeArray( value, decodeBoolean ),
    },
    {
        "names": {
            "json-array": 199,
            "jsonb-array": 3807,
        },

        "decode": value => decodeArray( value, JSON.parse ),
    },
    {
        "names": {
            "bigint-array": null,
        },

        "decode": value => decodeArray( value, BigInt ),
    },
    {
        "names": {
            "numeric-array": 1231,
        },

        "decode": value => decodeArray( value, String ),
    },
    {
        "names": {
            "decimal-array": null,
        },

        "decode": value => decodeArray( value, Decimal ),
    },
    {
        "names": {
            "bytea-array": 1001,
        },

        "decode": value => decodeArray( value, decodeBuffer ),
    },
];

// geberate number types
for ( let n = 1; n < 16; n++ ) {

    // number
    DEFAULT_TYPES.push(
        {
            "names": {
                [ `number${ n }` ]: null,
            },

            "decode": value => decodeNumber( value, n ),
        },
        {
            "names": {
                [ `number${ n }-array` ]: null,
            },

            "decode": valhe => decodeArray( valhe, value => decodeNumber( value, n ) ),
        }
    );
}

export const sqliteDecoders = {};

export const postgresqlDecoders = {};

for ( const type of DEFAULT_TYPES ) {
    for ( const name in type.names ) {
        const oid = type.names[ name ];

        if ( type.decodeSqlite || type.decode ) sqliteDecoders[ name ] = type.decodeSqlite || type.decode;

        if ( type.decodePostgresql || type.decode ) {
            postgresqlDecoders[ name ] = type.decodePostgresql || type.decode;

            if ( oid ) postgresqlDecoders[ oid ] = type.decodePostgresql || type.decode;
        }
    }
}
