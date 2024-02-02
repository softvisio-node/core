const MIN_NUMBER = -9007199254740991n,
    MAX_NUMBER = 9007199254740991n;

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
            "money": 790,
        },

        "decodePostgresql": buffer => {
            const string = buffer.toString( "latin1" ),
                idx = string.indexOf( "." );

            if ( idx > 15 ) {
                const integer = BigInt( string.substring( 0, idx ) );

                if ( integer < MIN_NUMBER || integer > MAX_NUMBER ) throw `Numeric value is out of JS Number range`;
            }

            return Number( string );
        },

        "decodeSqlite": value => {
            if ( typeof value === "number" ) return value;

            const string = value,
                idx = string.indexOf( "." );

            if ( idx > 15 ) {
                const integer = BigInt( string.substring( 0, idx ) );

                if ( integer < MIN_NUMBER || integer > MAX_NUMBER ) throw `Numeric value is out of JS Number range`;
            }

            return Number( string );
        },
    },

    // int8 as number
    {
        "names": {
            "int8": 20, // bigint
            "int53": null,
            "integer": null, // Sqlite specific number
        },

        "decodePostgresql": buffer => {
            const number = BigInt( buffer.toString( "latin1" ) );

            if ( number < MIN_NUMBER || number > MAX_NUMBER ) throw `Int8 value is out of JS Number range`;

            return Number( number );
        },

        // XXX
        "decodeSqlite": bigint => {
            if ( bigint < MIN_NUMBER || bigint > MAX_NUMBER ) throw `Int53 value is out of JS Number range`;

            return Number( bigint );
        },
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

        "decodePostgresql": buffer => Buffer.from( buffer.toString( "latin1", 2 ), "hex" ),
    },

    // bigint
    {
        "names": {
            "bigint": null,
        },

        "decodePostgresql": buffer => BigInt( buffer.toString( "latin1" ) ),

        // XXX
        "decodeSqlite": BigInt,
    },
];

// geberate number types
for ( let n = 1; n < 16; n++ ) {
    DEFAULT_TYPES.push( {
        "names": {
            [ `number${ n }` ]: null,
        },

        "decodePostgresql": buffer => {
            const string = buffer.toString( "latin1" ),
                idx = string.indexOf( "." );

            if ( idx > 15 ) {
                const integer = BigInt( string.substring( 0, idx ) );

                if ( integer < MIN_NUMBER || integer > MAX_NUMBER ) throw `Numeric value is out of JS Number range`;
            }

            return Number( Number( string ).toFixed( n ) );
        },

        // XXX
        "decodeSqlite": value => Number( Number( value ).toFixed( n ) ),
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
