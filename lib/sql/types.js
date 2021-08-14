import CONST from "#lib/const";

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
            "integer": null, // SQLite specific number
        },
        "decode": String,
    },

    // boolen
    {
        "names": {
            "bool": 16, // boolean
        },
        "decodePgsql": buffer => buffer[0] === 0x74, // "t"
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
        "decodePgsql": buffer => Buffer.from( buffer.toString( "latin1", 2 ), "hex" ),
    },

    // bigint
    {
        "names": {
            "bigint": null,
        },
        "decode": BigInt,
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
            if ( value != null && typeof value === "object" ) value[CONST.SQL_TYPE] = name;

            return value;
        };

        if ( type.decodeSqlite || type.decode ) DEFAULT_TYPES_SQLITE.decode[name] = type.decodeSqlite || type.decode;

        if ( type.decodePgsql || type.decode ) {
            DEFAULT_TYPES_PGSQL.decode[name] = type.decodePgsql || type.decode;

            if ( oid ) DEFAULT_TYPES_PGSQL.decode[oid] = type.decodePgsql || type.decode;
        }

        if ( type.encodeSqlite || type.encode ) DEFAULT_TYPES_SQLITE.encode[name] = type.encodeSqlite || type.encode;

        if ( type.encodePgsql || type.encode ) DEFAULT_TYPES_PGSQL.encode[name] = type.encodePgsql || type.encode;
    }
}
