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
        "decode_pgsql": buffer => buffer.toString( "latin1" ) === "t",
        "decode_sqlite": Boolean,
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
        "decode_pgsql": buffer => Buffer.from( buffer.toString( "latin1", 2 ), "hex" ),
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

        if ( type.decode_sqlite || type.decode ) DEFAULT_TYPES_SQLITE.decode[name] = type.decode_sqlite || type.decode;

        if ( type.decode_pgsql || type.decode ) {
            DEFAULT_TYPES_PGSQL.decode[name] = type.decode_pgsql || type.decode;

            if ( oid ) DEFAULT_TYPES_PGSQL.decode[oid] = type.decode_pgsql || type.decode;
        }

        if ( type.encode_sqlite || type.encode ) DEFAULT_TYPES_SQLITE.encode[name] = type.encode_sqlite || type.encode;

        if ( type.encode_pgsql || type.encode ) DEFAULT_TYPES_PGSQL.encode[name] = type.encode_pgsql || type.encode;
    }
}
