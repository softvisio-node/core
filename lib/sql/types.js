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
        "decode": Number,
    },

    // numbers as strings
    {
        "names": {
            "numeric": 1700, // decimal
            "int8": 20, // bigint
            "money": 790,
            "integer": null, // Sqlite specific number
        },
        "decode": String,
    },

    // boolen
    {
        "names": {
            "bool": 16, // boolean
        },
        "decodePgSql": buffer => buffer[0] === 0x74, // "t", "f"
        "decodeSqlite": Boolean,
    },

    // json
    {
        "names": {
            "json": 114,
            "jsonb": 3802,
        },
        "encode": JSON.stringify,
        "decode": JSON.parse,
    },

    // buffer
    {
        "names": {
            "bytea": 17,
        },
        "decodePgSql": buffer => Buffer.from( buffer.toString( "latin1", 2 ), "hex" ),
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
        "decodePgSql": buf => {
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

export const DEFAULT_TYPES_SQLITE = {
    "types": {},
    "encode": {},
    "decode": {},
};

export const DEFAULT_TYPES_PGSQL = {
    "types": {},
    "encode": {},
    "decode": {},
};

for ( const type of DEFAULT_TYPES ) {
    for ( const name in type.names ) {
        const oid = type.names[name];

        DEFAULT_TYPES_SQLITE.types[name] = DEFAULT_TYPES_PGSQL.types[name] = function ( value ) {
            if ( value != null && typeof value === "object" ) value[Symbol.for( "SQLType" )] = name;

            return value;
        };

        if ( type.decodeSqlite || type.decode ) DEFAULT_TYPES_SQLITE.decode[name] = type.decodeSqlite || type.decode;

        if ( type.decodePgSql || type.decode ) {
            DEFAULT_TYPES_PGSQL.decode[name] = type.decodePgSql || type.decode;

            if ( oid ) DEFAULT_TYPES_PGSQL.decode[oid] = type.decodePgSql || type.decode;
        }

        if ( type.encodeSQLite || type.encode ) DEFAULT_TYPES_SQLITE.encode[name] = type.encodeSQLite || type.encode;

        if ( type.encodePgSQL || type.encode ) DEFAULT_TYPES_PGSQL.encode[name] = type.encodePgSQL || type.encode;
    }
}
