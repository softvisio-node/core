const DEFAULT_TYPES = [

    // number
    {
        "names": {
            "int2": 21, // smallint
            "int4": 23, // integer
            "float4": 700, // real
            "float8": 701, // double
            "numeric": 1700, // decimal
            "money": 790,
            "oid": 26,
        },
        "decode": Number,
    },

    // numbers as strings
    {
        "names": {
            "int8": 20, // bigint
            "integer": null, // Sqlite specific number
        },
        "decode": String,
    },

    // boolean
    {
        "names": {
            "bool": 16, // boolean
        },
        "decodePostgresql": buffer => buffer[0] === 0x74, // "t", "f"
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
        "decode": BigInt,
    },

    // int53
    {
        "names": {
            "int53": null,
        },
        "decodePostgresql": buf => {
            var number = BigInt( buf );

            if ( number < -9007199254740991n || number > 9007199254740991n ) throw `Int53 value is out of range`;

            return Number( number );
        },

        "decodeSqlite": bigint => {
            if ( bigint < -9007199254740991n || bigint > 9007199254740991n ) throw `Int53 value is out of range`;

            return Number( bigint );
        },
    },
];

// geberate number types
for ( let n = 1; n < 16; n++ ) {
    DEFAULT_TYPES.push( {
        "names": {
            [`number${n}`]: null,
        },
        "decode": value => Number( Number( value ).toFixed( n ) ),
    } );
}

export const sqliteDecoders = {};

export const postgresqlDecoders = {};

for ( const type of DEFAULT_TYPES ) {
    for ( const name in type.names ) {
        const oid = type.names[name];

        if ( type.decodeSqlite || type.decode ) sqliteDecoders[name] = type.decodeSqlite || type.decode;

        if ( type.decodePostgresql || type.decode ) {
            postgresqlDecoders[name] = type.decodePostgresql || type.decode;

            if ( oid ) postgresqlDecoders[oid] = type.decodePostgresql || type.decode;
        }
    }
}
