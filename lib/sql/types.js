const MIN_NUMBER = BigInt( Number.MIN_SAFE_INTEGER ),
    MAX_NUMBER = BigInt( Number.MAX_SAFE_INTEGER );

export function encodeArray ( data, { readable } = {} ) {
    if ( data == null ) return "NULL";

    if ( !Array.isArray( data ) ) throw Error( `Unable to encode PostgreSQL array` );

    const space = readable ? " " : "",
        array = [];

    for ( let value of data ) {
        if ( value == null ) {
            value = "NULL";
        }
        else if ( typeof value === "string" ) {
            value = '"' + value.replaceAll( '"', '\\"' ) + '"';
        }
        else if ( typeof value === "boolean" ) {
            value = value ? "TRUE" : "FALSE";
        }
        else if ( typeof value === "object" ) {
            if ( Array.isArray( value ) ) {
                value = encodeArray( value, { readable } );
            }
            else {
                value = '"' + JSON.stringify( value ).replaceAll( '"', '\\"' ) + '"';
            }
        }
        else if ( typeof value !== "number" ) {
            throw Error( `Unable to encode PostgreSQL array` );
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
    if ( !data.startsWith( "{" ) ) throw Error( `Not a PostgreSQL array` );

    const arrays = [];

    var array,
        valueStart = null,
        valueEnd = null,
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

            // value quoted
            if ( quoteStarted ) {
                if ( data[ n ] === '"' ) {

                    // end quote
                    if ( data[ n - 1 ] !== "\\" ) {
                        quoteStarted = false;
                        valueEnd = n;
                    }
                }

                continue;
            }

            // end value
            else if ( data[ n ] === "}" || data[ n ] === "," ) {
                let value;

                // value is quoted
                if ( valueQuoted ) {
                    value = data.substring( valueStart, valueEnd ).replaceAll( '\\"', '"' );
                }

                // value is not quoted
                else {
                    value = data.substring( valueStart, n );

                    // remove trailing spaces
                    if ( value.endsWith( " " ) ) {
                        value = value.replace( / +$/, "" );
                    }

                    // NULL value
                    if ( value.toUpperCase() === "NULL" ) {
                        value = null;
                    }
                }

                valueQuoted = false;
                valueStart = null;
                valueEnd = null;

                // decode not null value
                if ( value != null ) {
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

function bigintToNumber ( value ) {
    if ( typeof value !== "bigint" ) {
        if ( Buffer.isBuffer( value ) ) {
            value = BigInt( value.toString( "latin1" ) );
        }
        else {
            value = BigInt( value );
        }
    }

    if ( value < MIN_NUMBER || value > MAX_NUMBER ) throw `Int53 value is out of JS Number range`;

    return Number( value );
}

function numericToNumber ( value ) {
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

            if ( bigint < MIN_NUMBER || bigint > MAX_NUMBER ) throw `Numeric value is out of JS Number range`;
        }
    }

    return Number( value );
}

function decodeBuffer ( value ) {
    if ( Buffer.isBuffer( value ) ) {
        return Buffer.from( value.toString( "latin1", 2 ), "hex" );
    }
    else {
        return Buffer.from( value.substring( 2 ), "hex" );
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

        "decodePostgresql": buffer => Number( buffer.toString( "latin1" ) ),

        "decodeSqlite": value => {
            if ( typeof value === "number" ) {
                if ( Number.isInteger( value ) ) {
                    return value;
                }
                else {
                    return Math.floor( value );
                }
            }
            else {
                return parseInt( value );
            }
        },
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

        "decode": bigintToNumber,
    },

    // boolean
    {
        "names": {
            "bool": 16, // boolean
        },

        "decodePostgresql": buffer => buffer[ 0 ] === 0x74, // "t", "f"

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

        "decodePostgresql": buffer => BigInt( buffer.toString( "latin1" ) ),

        "decodeSqlite": value => {
            if ( typeof value === "bigint" ) {
                return value;
            }
            else {
                return BigInt( value );
            }
        },
    },

    // arrays
    {
        "names": {
            "textArray": 1009,
            "moneyArray": 791,
        },

        "decodePostgresql": buffer => decodeArray( buffer.toString(), String ),
    },
    {
        "names": {
            "int2Array": 1005,
            "int4Array": 1007,
            "float4Array": 1021,
            "float8Array": 1022,
        },

        "decodePostgresql": buffer => decodeArray( buffer.toString( "latin1" ), Number ),
    },
    {
        "names": {
            "int8Array": 1016,
            "int53Array": null,
        },

        "decodePostgresql": buffer => decodeArray( buffer.toString( "latin1" ), bigintToNumber ),
    },
    {
        "names": {
            "boolArray": 1000,
        },

        "decodePostgresql": buffer => decodeArray( buffer.toString( "latin1" ), value => value === "t" ),
    },
    {
        "names": {
            "jsonArray": 199,
            "moneyArray": 3807,
        },

        "decodePostgresql": buffer => decodeArray( buffer.toString(), JSON.parse ),
    },
    {
        "names": {
            "bigintArray": null,
        },

        "decodePostgresql": buffer => decodeArray( buffer.toString( "latin1" ), BigInt ),
    },
    {
        "names": {
            "numericArray": 1231,
        },

        "decodePostgresql": buffer => decodeArray( buffer.toString( "latin1" ), numericToNumber ),
    },
    {
        "names": {
            "byteaArray": 1001,
        },

        "decodePostgresql": buffer => decodeArray( buffer.toString( "latin1" ), decodeBuffer ),
    },
];

// geberate number types
for ( let n = 1; n < 16; n++ ) {
    DEFAULT_TYPES.push( {
        "names": {
            [ `number${ n }` ]: null,
        },

        "decodePostgresql": buffer => {
            const string = buffer.toString( "latin1" );

            if ( string.length > 15 ) {
                const idx = string.indexOf( "." );

                if ( idx > 15 ) {
                    const bigint = BigInt( string.substring( 0, idx ) );

                    if ( bigint < MIN_NUMBER || bigint > MAX_NUMBER ) throw `Numeric value is out of JS Number range`;
                }
            }

            return Number( Number( string ).toFixed( n ) );
        },

        "decodeSqlite": value => {
            if ( typeof value === "number" ) {
                Number( value.toFixed( n ) );
            }
            else if ( typeof value === "bigint" ) {
                if ( value < MIN_NUMBER || value > MAX_NUMBER ) throw `Numeric value is out of JS Number range`;

                return Number( value );
            }
            else {
                const string = value + "",
                    idx = string.indexOf( "." );

                if ( idx > 15 ) {
                    const integer = BigInt( string.substring( 0, idx ) );

                    if ( integer < MIN_NUMBER || integer > MAX_NUMBER ) throw `Numeric value is out of JS Number range`;
                }

                return Number( Number( string ).toFixed( n ) );
            }
        },
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
