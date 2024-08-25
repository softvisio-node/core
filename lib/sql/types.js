const MIN_NUMBER = BigInt( Number.MIN_SAFE_INTEGER ),
    MAX_NUMBER = BigInt( Number.MAX_SAFE_INTEGER );

export function encodeBuffer ( value ) {
    return "\\x" + value.toString( "hex" );
}

export function decodeBuffer ( value ) {
    if ( Buffer.isBuffer( value ) ) {
        return Buffer.from( value.toString( "latin1", 2 ), "hex" );
    }
    else {
        return Buffer.from( value.substring( 2 ), "hex" );
    }
}

export function encodeDate ( value ) {
    return value.toISOString();
}

export function encodeArray ( data, { readable } = {} ) {
    if ( data == null ) return "NULL";

    if ( !Array.isArray( data ) ) throw TypeError( `Unable to encode PostgreSQL array` );

    const space = readable ? " " : "",
        array = [];

    for ( let value of data ) {
        if ( value == null ) {
            value = "NULL";
        }
        else if ( typeof value === "string" ) {
            value = '"' + value.replaceAll( "\\", "\\\\" ).replaceAll( '"', '\\"' ) + '"';
        }
        else if ( typeof value === "boolean" ) {
            value = value ? "TRUE" : "FALSE";
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
        data = Buffer.toString();
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
                    value = data.substring( valueStart, valueEnd );
                }

                // value is not quoted
                else {
                    value = data.substring( valueStart, n );

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
                if ( data[ n ] === "}" ) {
                    if ( arrays.length ) {
                        array = arrays.pop();
                    }
                }
            }
        }
    }

    return array;
}

export function decodeBoolean ( value ) {
    if ( Buffer.isBuffer( value ) ) {
        return value[ 0 ] === 0x74; // "t", "f"
    }
    else if ( typeof value === "string" ) {
        return value === "t" || value.toLowerCase() === "true";
    }
    else {
        return Boolean( value );
    }
}

// XXX
export function decodeInteger ( value ) {
    if ( Buffer.isBuffer( value ) ) {
        return parseInt( value.toString( "latin1" ) );
    }

    // else if ( typeof value === "number" ) {
    //     if ( Number.isInteger( value ) ) {
    //         return value;
    //     }
    //     else {
    //         return Math.floor( value );
    //     }
    // }
    else {
        return parseInt( value );
    }
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

// XXX
export function bigintToInteger ( value ) {
    if ( typeof value !== "bigint" ) {
        if ( Buffer.isBuffer( value ) ) {
            value = BigInt( value.toString( "latin1" ) );
        }
        else {
            value = BigInt( value );
        }
    }

    if ( value < MIN_NUMBER || value > MAX_NUMBER ) throw RangeError( `Int53 value is out of JS Number range` );

    return Number( value );
}

export function numericToNumber ( value ) {
    if ( typeof value === "number" ) return value;

    if ( Buffer.isBuffer( value ) ) {
        value = value.toString( "latin1" );
    }
    else {
        value += "";
    }

    if ( value.length > 15 ) {
        const idx = value.indexOf( "." );

        if ( idx > 15 ) {
            const bigint = BigInt( value.substring( 0, idx ) );

            if ( bigint < MIN_NUMBER || bigint > MAX_NUMBER ) throw RangeError( `Numeric value is out of JS Number range` );
        }
    }

    return Number( value );
}

export function numericToFixed ( value, fixed ) {
    if ( typeof value === "number" ) {
        Number( value.toFixed( fixed ) );
    }
    else if ( typeof value === "bigint" ) {
        if ( value < MIN_NUMBER || value > MAX_NUMBER ) throw RangeError( `Numeric value is out of JS Number range` );

        return Number( value );
    }
    else {
        if ( Buffer.isBuffer( value ) ) {
            value = value.toString( "latin1" );
        }

        if ( value.length > 15 ) {
            const idx = value.indexOf( "." );

            if ( idx > 15 ) {
                const bigint = BigInt( value.substring( 0, idx ) );

                if ( bigint < MIN_NUMBER || bigint > MAX_NUMBER ) throw RangeError( `Numeric value is out of JS Number range` );
            }
        }

        return Number( Number( value ).toFixed( fixed ) );
    }
}

const DEFAULT_TYPES = [

    // number
    {
        "names": {
            "int2": 21, // smallint
            "int4": 23, // integer
            "float4": 700, // real
            "float8": 701, // double
            "oid": 26,
        },

        "decode": decodeInteger,
    },

    // numeric
    {
        "names": {
            "numeric": 1700, // decimal
        },

        "decode": numericToNumber,
    },

    // int8 as number
    {
        "names": {
            "int8": 20, // bigint
            "int53": null,
            "integer": null, // Sqlite specific number
        },

        "decode": bigintToInteger,
    },

    // boolean
    {
        "names": {
            "bool": 16, // boolean
        },

        "decode": decodeBoolean,
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
            "textArray": 1009,
            "moneyArray": 791,
        },

        "decode": buffer => decodeArray( buffer, String ),
    },
    {
        "names": {
            "int2Array": 1005,
            "int4Array": 1007,
            "float4Array": 1021,
            "float8Array": 1022,
        },

        "decode": buffer => decodeArray( buffer, Number ),
    },
    {
        "names": {
            "int8Array": 1016,
            "int53Array": null,
        },

        "decode": buffer => decodeArray( buffer, bigintToInteger ),
    },
    {
        "names": {
            "boolArray": 1000,
        },

        "decode": buffer => decodeArray( buffer, decodeBoolean ),
    },
    {
        "names": {
            "jsonArray": 199,
            "moneyArray": 3807,
        },

        "decode": buffer => decodeArray( buffer, JSON.parse ),
    },
    {
        "names": {
            "bigintArray": null,
        },

        "decode": buffer => decodeArray( buffer, BigInt ),
    },
    {
        "names": {
            "numericArray": 1231,
        },

        "decode": buffer => decodeArray( buffer, numericToNumber ),
    },
    {
        "names": {
            "byteaArray": 1001,
        },

        "decode": buffer => decodeArray( buffer, decodeBuffer ),
    },
];

// geberate number types
for ( let n = 1; n < 16; n++ ) {

    // number
    DEFAULT_TYPES.push( {
        "names": {
            [ `number${ n }` ]: null,
        },

        "decode": valhe => value => numericToFixed( value, n ),
    } );

    // number arrays
    DEFAULT_TYPES.push( {
        "names": {
            [ `number${ n }Array` ]: null,
        },

        "decode": valhe => decodeArray( valhe, value => numericToFixed( value, n ) ),
    } );
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
